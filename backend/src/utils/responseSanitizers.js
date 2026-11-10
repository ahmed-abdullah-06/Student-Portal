/**
 * Response mappers keep credentials and operational secrets out of API payloads.
 * Keep these explicit instead of relying on Prisma's implicit model shape.
 */
function sanitizeUser(user) {
  if (!user) return user;
  const { password, refreshToken, resetToken, resetTokenExpiresAt, tokenVersion, ...safe } = user;
  return safe;
}

function sanitizeStudent(student) {
  if (!student) return student;
  const { cnic, address, guardianName, ...safe } = student;
  return { ...safe, user: sanitizeUser(student.user) };
}

function sanitizeFaculty(faculty) {
  if (!faculty) return faculty;
  return { ...faculty, user: sanitizeUser(faculty.user) };
}

module.exports = { sanitizeUser, sanitizeStudent, sanitizeFaculty };
