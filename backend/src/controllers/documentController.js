const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');
const { UPLOAD_DIR } = require('../middlewares/upload');

exports.listDocuments = async (req, res, next) => {
  try {
    const category = req.query.category;
    const where = category ? { category } : {};
    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, category: true, description: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    res.json({ documents });
  } catch (err) {
    next(err);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File is required' });
    const { title, category, description } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const doc = await prisma.document.create({
      data: {
        title,
        category: category || 'General',
        description: description || null,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploaderId: req.user.id,
      },
    });

    logAudit('UPLOAD_DOCUMENT', {
      userId: req.user.id,
      entity: 'Document',
      entityId: doc.id,
      ipAddress: req.ip,
      details: `Uploaded "${title}"`,
    });

    res.status(201).json({ document: doc, message: 'Document uploaded' });
  } catch (err) {
    next(err);
  }
};

exports.downloadDocument = async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const filePath = path.join(UPLOAD_DIR, doc.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on server' });
    res.download(filePath, doc.fileName);
  } catch (err) {
    next(err);
  }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const filePath = path.join(UPLOAD_DIR, doc.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.document.delete({ where: { id: doc.id } });
    logAudit('DELETE_DOCUMENT', {
      userId: req.user.id,
      entity: 'Document',
      entityId: doc.id,
      ipAddress: req.ip,
      details: `Deleted "${doc.title}"`,
    });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
};
