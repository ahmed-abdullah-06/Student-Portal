const GRADE_SCALE = [
  { min: 85, letter: 'A', points: 4.0 },
  { min: 80, letter: 'A-', points: 3.67 },
  { min: 75, letter: 'B+', points: 3.33 },
  { min: 70, letter: 'B', points: 3.0 },
  { min: 65, letter: 'B-', points: 2.67 },
  { min: 60, letter: 'C+', points: 2.33 },
  { min: 55, letter: 'C', points: 2.0 },
  { min: 50, letter: 'C-', points: 1.67 },
  { min: 45, letter: 'D', points: 1.0 },
  { min: 0, letter: 'F', points: 0.0 },
];

const WEIGHTS = { assignments: 0.1, quizzes: 0.1, midterms: 0.2, finals: 0.6 };
const MIN_ATTENDANCE = 75;

function computeWeightedPercentage({ assignments = 0, quizzes = 0, midterms = 0, finals = 0 }) {
  return (
    assignments * WEIGHTS.assignments +
    quizzes * WEIGHTS.quizzes +
    midterms * WEIGHTS.midterms +
    finals * WEIGHTS.finals
  );
}

function gradeFromPercentage(percentage) {
  const band = GRADE_SCALE.find((g) => percentage >= g.min);
  return { letter: band.letter, points: band.points };
}

function computeSemesterGPA(enrollments) {
  let totalPoints = 0;
  let totalCredits = 0;
  for (const e of enrollments) {
    if (e.status !== 'COMPLETED') continue;
    const cr = e.section?.course?.creditHours ?? 0;
    totalCredits += cr;
    totalPoints += cr * (e.gradePoints ?? 0);
  }
  const sgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  return { sgpa: round2(sgpa), totalPoints: round2(totalPoints), creditHours: totalCredits };
}

function computeCGPA(records) {
  let points = 0;
  let credits = 0;
  for (const r of records) {
    points += r.totalPoints;
    credits += r.creditHours;
  }
  return credits > 0 ? round2(points / credits) : 0;
}

function attendancePercentage(attended, total) {
  if (total === 0) return 100;
  return round2((attended / total) * 100);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  GRADE_SCALE,
  WEIGHTS,
  MIN_ATTENDANCE,
  computeWeightedPercentage,
  gradeFromPercentage,
  computeSemesterGPA,
  computeCGPA,
  attendancePercentage,
  round2,
};
