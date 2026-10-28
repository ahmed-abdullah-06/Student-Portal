require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  const h = await bcrypt.hash('student123', 12);
  await prisma.user.update({ where: { email: 'sp23-bscs-001@student.novastra.edu.pk' }, data: { password: h, mustChangePassword: false } });
  console.log('reverted');
  await prisma.$disconnect();
})();
