import bcrypt from 'bcrypt'
import { prisma } from '../src/config/prisma.js'

const DEPARTAMENTOS = [
  'Administración',
  'Sistemas',
  'Contabilidad',
  'Derecho',
  'Enfermería',
  'Gastronomía',
]

const TIPOS_PROFESOR = [
  'Titular',
  'Adjunto',
  'Hora-clase',
]

async function main() {
  // Crear departamentos
  for (const nombre of DEPARTAMENTOS) {
    await prisma.departamento.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }
  console.log('Departamentos creados:', DEPARTAMENTOS.join(', '))

  // Crear tipos de profesor
  for (const nombre of TIPOS_PROFESOR) {
    await prisma.tipoProfesor.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }
  console.log('Tipos de profesor creados:', TIPOS_PROFESOR.join(', '))

  // Crear admin
  const EMAIL = 'admin@iest.mx'
  const existing = await prisma.profesor.findUnique({ where: { email: EMAIL } })
  if (existing) {
    console.log('El usuario admin ya existe, omitiendo.')
    return
  }

  const departamentoAdmin = await prisma.departamento.findUnique({ where: { nombre: 'Administración' } })
  const hashedPassword = await bcrypt.hash('chato3017', 10)

  await prisma.profesor.create({
    data: {
      nombre: 'Administrador',
      email: EMAIL,
      password: hashedPassword,
      departamentoId: departamentoAdmin.id,
      role: 'admin',
    },
  })

  console.log('Admin creado:', EMAIL)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
