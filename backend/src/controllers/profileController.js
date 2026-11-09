const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');
const path = require('path');

const PROFILE_FIELDS = [
  'name', 'phone', 'cnic', 'guardianName', 'guardianPhone', 'address', 'permanentAddress',
  'gender', 'bloodGroup', 'nationality', 'emergencyContactName', 'emergencyContactPhone',
  'advisorName',
];
const NUMERIC_FIELDS = ['matricMarks', 'interMarks'];

function computeCompletion(student) {
  const checks = [
    !!student.name,
    !!student.phone,
    !!student.cnic,
    !!student.guardianName,
    !!student.address,
    !!student.dateOfBirth,
    !!student.gender,
    !!student.bloodGroup,
    !!student.emergencyContactName,
    !!student.emergencyContactPhone,
    !!student.permanentAddress,
    student.matricMarks != null,
    student.interMarks != null,
    !!student.photoUrl,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

exports.getProfile = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ student, completion: computeCompletion(student) });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const d = req.validated || req.body;
    const data = {};

    for (const f of PROFILE_FIELDS) {
      if (d[f] !== undefined) data[f] = d[f] === '' ? null : d[f];
    }
    for (const f of NUMERIC_FIELDS) {
      if (d[f] !== undefined) data[f] = d[f] === null || d[f] === '' ? null : Number(d[f]);
    }
    if (d.dateOfBirth !== undefined) {
      data.dateOfBirth = d.dateOfBirth ? new Date(d.dateOfBirth) : null;
    }

    const updated = await prisma.student.update({ where: { id: student.id }, data });

    logAudit('UPDATE_PROFILE', {
      userId: req.user.id,
      entity: 'Student',
      entityId: student.id,
      ipAddress: req.ip,
      details: 'Student updated own profile',
    });

    res.json({ student: updated, completion: computeCompletion(updated), message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

exports.facultyUpdateProfile = async (req, res, next) => {
  try {
    const faculty = await prisma.faculty.findUnique({ where: { userId: req.user.id } });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });
    const { name, phone, designation, officeHours, bio } = req.body;
    const data = {};
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (designation) data.designation = designation;
    if (officeHours !== undefined) data.officeHours = officeHours;
    if (bio !== undefined) data.bio = bio;
    const updated = await prisma.faculty.update({ where: { id: faculty.id }, data });
    res.json({ faculty: updated, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

exports.updatePhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'A JPG, PNG, or WebP photo is required' });
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const photoUrl = `/uploads/${path.basename(req.file.filename)}`;
    const updated = await prisma.student.update({ where: { id: student.id }, data: { photoUrl } });
    res.json({ photoUrl: updated.photoUrl, message: 'Profile photo updated' });
  } catch (err) {
    next(err);
  }
};
