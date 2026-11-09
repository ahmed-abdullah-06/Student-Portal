const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

const DEFAULT_LOAN_DAYS = 14;

function calcFine(dueDate) {
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (24 * 60 * 60 * 1000));
  return days > 0 ? days * 50 : 0;
}

exports.listBooks = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const books = await prisma.libraryBook.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { isbn: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { title: 'asc' },
    });
    res.json({ books });
  } catch (err) {
    next(err);
  }
};

exports.myIssues = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const issues = await prisma.libraryIssue.findMany({
      where: { studentId: student.id },
      include: { book: { select: { title: true, author: true, isbn: true } } },
      orderBy: { issueDate: 'desc' },
    });

    const withStatus = issues.map((i) => {
      const overdue = i.status === 'ISSUED' && new Date(i.dueDate) < new Date();
      const fine = i.status === 'RETURNED' ? i.fine : overdue ? calcFine(i.dueDate) : 0;
      return { ...i, overdue, fine };
    });

    res.json({ issues: withStatus });
  } catch (err) {
    next(err);
  }
};

exports.issueBook = async (req, res, next) => {
  try {
    const { bookId, studentId, loanDays } = req.body;
    if (!bookId || !studentId) return res.status(400).json({ message: 'bookId and studentId are required' });

    const book = await prisma.libraryBook.findUnique({ where: { id: bookId } });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.copiesAvailable <= 0) return res.status(400).json({ message: 'No copies available' });

    const active = await prisma.libraryIssue.count({
      where: { studentId, status: 'ISSUED' },
    });
    if (active >= 3) return res.status(400).json({ message: 'Student already has 3 active issues (max)' });

    const days = Number(loanDays) > 0 ? Number(loanDays) : DEFAULT_LOAN_DAYS;
    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.libraryIssue.create({
        data: {
          bookId,
          studentId,
          dueDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        },
        include: { book: true, student: { select: { rollNumber: true, name: true } } },
      });
      await tx.libraryBook.update({ where: { id: bookId }, data: { copiesAvailable: { decrement: 1 } } });
      return created;
    });

    logAudit('LIBRARY_ISSUE', {
      userId: req.user.id, entity: 'LibraryIssue', entityId: issue.id, ipAddress: req.ip,
      details: `${book.title} → ${issue.student.rollNumber}`,
    });

    res.status(201).json({ issue });
  } catch (err) {
    next(err);
  }
};

exports.returnBook = async (req, res, next) => {
  try {
    const issue = await prisma.libraryIssue.findUnique({
      where: { id: req.params.id },
      include: { book: true, student: { select: { rollNumber: true } } },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.status === 'RETURNED') return res.status(400).json({ message: 'Already returned' });

    const fine = calcFine(issue.dueDate);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.libraryIssue.update({
        where: { id: issue.id },
        data: { status: 'RETURNED', returnDate: new Date(), fine },
      });
      await tx.libraryBook.update({ where: { id: issue.bookId }, data: { copiesAvailable: { increment: 1 } } });
      return u;
    });

    logAudit('LIBRARY_RETURN', {
      userId: req.user.id, entity: 'LibraryIssue', entityId: issue.id, ipAddress: req.ip,
      details: `${issue.book.title} from ${issue.student.rollNumber}, fine Rs. ${fine}`,
    });

    res.json({ issue: updated, fine });
  } catch (err) {
    next(err);
  }
};

exports.listIssues = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const issues = await prisma.libraryIssue.findMany({
      where,
      include: {
        book: { select: { title: true, author: true } },
        student: { select: { rollNumber: true, name: true } },
      },
      orderBy: { issueDate: 'desc' },
      take: 200,
    });
    res.json({ issues });
  } catch (err) {
    next(err);
  }
};

exports.createBook = async (req, res, next) => {
  try {
    const { title, author, isbn, category, copiesTotal } = req.body;
    if (!title || !author || !isbn) return res.status(400).json({ message: 'title, author, isbn are required' });
    const copies = Number(copiesTotal) || 1;
    const book = await prisma.libraryBook.create({
      data: { title, author, isbn, category: category || 'General', copiesTotal: copies, copiesAvailable: copies },
    });
    logAudit('LIBRARY_BOOK_CREATED', { userId: req.user.id, entity: 'LibraryBook', entityId: book.id, ipAddress: req.ip, details: title });
    res.status(201).json({ book });
  } catch (err) {
    next(err);
  }
};

exports.updateBook = async (req, res, next) => {
  try {
    const { title, author, category, copiesTotal } = req.body;
    const existing = await prisma.libraryBook.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Book not found' });

    const data = {};
    if (title !== undefined) data.title = title;
    if (author !== undefined) data.author = author;
    if (category !== undefined) data.category = category;
    if (copiesTotal !== undefined) {
      const total = Number(copiesTotal);
      const issued = existing.copiesTotal - existing.copiesAvailable;
      if (total < issued) return res.status(400).json({ message: `Cannot reduce below ${issued} (issued copies)` });
      data.copiesTotal = total;
      data.copiesAvailable = total - issued;
    }
    const book = await prisma.libraryBook.update({ where: { id: req.params.id }, data });
    res.json({ book });
  } catch (err) {
    next(err);
  }
};

exports.deleteBook = async (req, res, next) => {
  try {
    const active = await prisma.libraryIssue.count({
      where: { bookId: req.params.id, status: 'ISSUED' },
    });
    if (active > 0) return res.status(400).json({ message: 'Cannot delete — copies are currently issued' });
    await prisma.libraryBook.delete({ where: { id: req.params.id } });
    logAudit('LIBRARY_BOOK_DELETED', { userId: req.user.id, entity: 'LibraryBook', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};
