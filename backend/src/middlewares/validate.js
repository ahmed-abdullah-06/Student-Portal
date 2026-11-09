const { z } = require('zod');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      return res.status(400).json({ message: first.message, field: first.path.join('.') });
    }
    req.validated = result.data;
    next();
  };
}

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64)
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[0-9]/, 'Must include a number');

const schemas = {
  login: z.object({
    email: z.string().min(1, 'Email or registration number is required'),
    password: z.string().min(1, 'Password is required'),
    role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']).optional(),
    captcha: z.string().optional(),
    captchaToken: z.string().optional(),
    totp: z.string().optional(),
    pendingToken: z.string().optional(),
  }),
  confirm2FA: z.object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  }),
  disable2FA: z.object({
    password: z.string().optional(),
    code: z.string().optional(),
  }).refine((d) => !!d.password || !!d.code, {
    message: 'Provide your password or current 2FA code',
    path: ['password'],
  }),
  changePassword: z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  }).refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  }),
  forgotPassword: z.object({
    email: z.string().min(1, 'Email or registration number is required'),
  }),
  resetPassword: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  }).refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
  updateProfile: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().max(20).optional(),
    cnic: z.string().max(20).optional(),
    guardianName: z.string().max(100).optional(),
    guardianPhone: z.string().max(20).optional(),
    address: z.string().max(300).optional(),
    permanentAddress: z.string().max(300).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    bloodGroup: z.string().max(5).optional(),
    nationality: z.string().max(50).optional(),
    emergencyContactName: z.string().max(100).optional(),
    emergencyContactPhone: z.string().max(20).optional(),
    matricMarks: z.coerce.number().min(0).max(1100).optional(),
    interMarks: z.coerce.number().min(0).max(1100).optional(),
    advisorName: z.string().max(100).optional(),
  }),
  registerCourse: z.object({
    sectionId: z.string().min(1, 'Section is required'),
  }),
  withdraw: z.object({
    sectionId: z.string().min(1, 'Course is required'),
    reason: z.string().min(3, 'Reason is required'),
    comments: z.string().max(500).optional(),
  }),
  complaint: z.object({
    category: z.string().min(1),
    subject: z.string().min(3, 'Subject is required'),
    description: z.string().min(10, 'Description is required'),
  }),
  evaluation: z.object({
    sectionId: z.string().min(1),
    punctuality: z.number().int().min(1).max(5),
    knowledge: z.number().int().min(1).max(5),
    communication: z.number().int().min(1).max(5),
    helpfulness: z.number().int().min(1).max(5),
    overall: z.number().int().min(1).max(5),
    feedback: z.string().max(1000).optional(),
  }),
  recheck: z.object({
    enrollmentId: z.string().min(1),
    reason: z.string().min(5, 'Reason is required'),
  }),
  freeze: z.object({
    semester: z.number().int().min(1).max(8),
    year: z.number().int().min(2020).max(2035),
    reason: z.string().min(5, 'Reason is required'),
  }),
  installment: z.object({
    challanId: z.string().min(1),
    plan: z.enum(['2_PARTS', '3_PARTS']),
    reason: z.string().min(5),
  }),
  refund: z.object({
    challanId: z.string().min(1),
    amount: z.number().positive('Amount must be positive'),
    reason: z.string().min(5),
  }),
  scholarshipApply: z.object({
    statement: z.string().min(20, 'Statement must be at least 20 characters'),
  }),
  certificateRequest: z.object({
    type: z.enum(['TRANSCRIPT', 'DEGREE', 'NOC', 'CHARACTER']),
  }),
  bankProof: z.object({
    challanId: z.string().min(1),
    reference: z.string().min(3, 'Transaction reference is required'),
  }),
  semester: z.object({
    name: z.string().min(3),
    year: z.number().int().min(2020).max(2035),
    term: z.enum(['FALL', 'SPRING', 'SUMMER']),
    registrationOpen: z.string().optional(),
    registrationClose: z.string().optional(),
    evaluationOpen: z.string().optional(),
    evaluationClose: z.string().optional(),
    resultPublishDate: z.string().optional(),
    feeDueDate: z.string().optional(),
  }),
  examSchedule: z.object({
    sectionId: z.string().min(1),
    semesterId: z.string().min(1),
    type: z.enum(['MIDTERM', 'FINAL']),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    room: z.string().optional(),
  }),
  scholarship: z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    amount: z.number().positive(),
    eligibility: z.string().min(3),
    deadline: z.string().min(1),
  }),
  notice: z.object({
    title: z.string().min(3, 'Title is required'),
    body: z.string().min(5, 'Body is required'),
    category: z.string().optional(),
  }),
};

module.exports = { validate, schemas, passwordSchema };
