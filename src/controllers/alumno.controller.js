import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import { ok, created, paginated, err } from "../utils/apiResponse.js";

const ALUMNO_SELECT = {
  id: true, nombre: true, email: true,
  matricula: true, role: true, createdAt: true,
};

export const getAlumnos = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [alumnos, total] = await Promise.all([
      prisma.alumno.findMany({ select: ALUMNO_SELECT, skip, take: limit, orderBy: { nombre: "asc" } }),
      prisma.alumno.count(),
    ]);

    return paginated(res, alumnos, total, page, Math.ceil(total / limit));
  } catch (error) {
    next(error);
  }
};

export const createAlumno = async (req, res, next) => {
  try {
    const { nombre, email, password, matricula } = req.body;

    const alumnoExistente = await prisma.alumno.findUnique({ where: { email } });
    if (alumnoExistente) return err(res, "El email ya está registrado");

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoAlumno = await prisma.alumno.create({
      data: { nombre, email, password: hashedPassword, matricula },
      select: ALUMNO_SELECT,
    });

    return created(res, nuevoAlumno);
  } catch (error) {
    next(error);
  }
};

export const updateAlumno = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, email, matricula } = req.body;

    const alumnoActualizado = await prisma.alumno.update({
      where: { id: Number(id) },
      data: { nombre, email, matricula },
      select: ALUMNO_SELECT,
    });

    return ok(res, alumnoActualizado);
  } catch (error) {
    next(error);
  }
};

export const deleteAlumno = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.alumno.delete({ where: { id: Number(id) } });

    return ok(res, null);
  } catch (error) {
    next(error);
  }
};
