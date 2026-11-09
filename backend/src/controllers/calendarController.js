const prisma = require('../config/db');

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

exports.list = async (req, res, next) => {
  try {
    const from = parseDate(req.query.from) || new Date();
    const to = parseDate(req.query.to) || new Date(from.getTime() + 370 * 86400000);
    const [events, semester] = await Promise.all([
      prisma.calendarEvent.findMany({
      where: { startsAt: { gte: from, lte: to } },
      orderBy: { startsAt: 'asc' },
      }),
      prisma.semester.findFirst({
        where: { isCurrent: true, isActive: true },
        select: { id: true, name: true, registrationOpen: true, registrationClose: true, evaluationOpen: true, evaluationClose: true, resultPublishDate: true, feeDueDate: true },
      }),
    ]);
    const semesterEvents = semester ? [
      semester.registrationOpen && { id: `semester-registration-open-${semester.id}`, title: `${semester.name} registration opens`, eventType: 'SEMESTER', startsAt: semester.registrationOpen, allDay: true },
      semester.registrationClose && { id: `semester-registration-close-${semester.id}`, title: `${semester.name} registration closes`, eventType: 'SEMESTER', startsAt: semester.registrationClose, allDay: true },
      semester.evaluationOpen && { id: `semester-evaluation-open-${semester.id}`, title: `${semester.name} evaluations open`, eventType: 'SEMESTER', startsAt: semester.evaluationOpen, allDay: true },
      semester.evaluationClose && { id: `semester-evaluation-close-${semester.id}`, title: `${semester.name} evaluations close`, eventType: 'SEMESTER', startsAt: semester.evaluationClose, allDay: true },
      semester.resultPublishDate && { id: `semester-results-${semester.id}`, title: `${semester.name} results published`, eventType: 'SEMESTER', startsAt: semester.resultPublishDate, allDay: true },
      semester.feeDueDate && { id: `semester-fee-${semester.id}`, title: `${semester.name} fee due`, eventType: 'SEMESTER', startsAt: semester.feeDueDate, allDay: true },
    ].filter(Boolean).filter((event) => event.startsAt >= from && event.startsAt <= to) : [];
    res.json({ events: [...events, ...semesterEvents].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), semester });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const startsAt = parseDate(req.body.startsAt);
    const endsAt = req.body.endsAt ? parseDate(req.body.endsAt) : null;
    if (!req.body.title || !startsAt || (req.body.endsAt && !endsAt)) {
      return res.status(400).json({ message: 'title and valid startsAt are required' });
    }
    const event = await prisma.calendarEvent.create({
      data: {
        title: req.body.title.trim(),
        description: req.body.description?.trim() || null,
        eventType: req.body.eventType || 'ACADEMIC',
        startsAt,
        endsAt,
        allDay: req.body.allDay !== false,
      },
    });
    res.status(201).json({ event });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const data = {};
    for (const key of ['title', 'description', 'eventType']) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (req.body.startsAt !== undefined) data.startsAt = parseDate(req.body.startsAt);
    if (req.body.endsAt !== undefined) data.endsAt = req.body.endsAt ? parseDate(req.body.endsAt) : null;
    if (req.body.allDay !== undefined) data.allDay = Boolean(req.body.allDay);
    if (data.startsAt === null) return res.status(400).json({ message: 'Invalid startsAt' });
    const event = await prisma.calendarEvent.update({ where: { id: req.params.id }, data });
    res.json({ event });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Calendar event deleted' });
  } catch (err) { next(err); }
};
