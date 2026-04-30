import bcrypt from 'bcrypt'
import { prisma } from '../src/config/prisma.js'

const EMAIL = 'admin@iest.mx'
const PASSWORD = 'chato3017'

async function main() {
  const existing = await prisma.profesor.findUnique({ where: { email: EMAIL } })
  if (existing) {
    console.log('El usuario admin ya existe, omitiendo.')
    return
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 10)

  await prisma.profesor.create({
    data: {
      nombre: 'Administrador',
      email: EMAIL,
      password: hashedPassword,
      departamento: 'Administración',
      role: 'admin',
    },
  })

  console.log('Admin creado:', EMAIL)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
