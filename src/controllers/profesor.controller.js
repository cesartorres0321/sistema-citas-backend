import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import { ok, created, paginated, err } from "../utils/apiResponse.js";

const PROFESOR_SELECT = {
  id: true, nombre: true, email: true,
  departamento: true, role: true, duracionCita: true, createdAt: true,
};

export const getProfesores = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [profesores, total] = await Promise.all([
      prisma.profesor.findMany({ select: PROFESOR_SELECT, skip, take: limit, orderBy: { nombre: "asc" } }),
      prisma.profesor.count(),
    ]);

    return paginated(res, profesores, total, page, Math.ceil(total / limit));
  } catch (error) {
    next(error);
  }
};

export const getProfesorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profesor = await prisma.profesor.findUnique({
      where: { id: Number(id) },
      select: PROFESOR_SELECT,
    });

    if (!profesor) return err(res, "Profesor no encontrado", 404);

    return ok(res, profesor);
  } catch (error) {
    next(error);
  }
};

export const createProfesor = async (req, res, next) => {
  try {
    const { nombre, email, password, departamento } = req.body;

    const profesorExistente = await prisma.profesor.findUnique({ where: { email } });
    if (profesorExistente) return err(res, "El email ya está registrado");

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoProfesor = await prisma.profesor.create({
      data: { nombre, email, password: hashedPassword, departamento },
      select: PROFESOR_SELECT,
    });

    return created(res, nuevoProfesor);
  } catch (error) {
    next(error);
  }
};

export const updateProfesor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, email, departamento } = req.body;

    const profesorActualizado = await prisma.profesor.update({
      where: { id: Number(id) },
      data: { nombre, email, departamento },
      select: PROFESOR_SELECT,
    });

    return ok(res, profesorActualizado);
  } catch (error) {
    next(error);
  }
};

export const deleteProfesor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profesor = await prisma.profesor.findUnique({ where: { id: Number(id) } });
    if (!profesor) return err(res, "Profesor no encontrado", 404);

    await prisma.profesor.delete({ where: { id: Number(id) } });

    return ok(res, null);
  } catch (error) {
    next(error);
  }
};

export const updateDuracionCita = async (req, res, next) => {
  try {
    const { duracionCita } = req.body;
    const { id, role } = req.user;

    if (role !== "profesor") return err(res, "Solo los profesores pueden cambiar la duración", 403);

    const profesor = await prisma.profesor.update({
      where: { id },
      data: { duracionCita: Number(duracionCita) },
      select: PROFESOR_SELECT,
    });

    return ok(res, profesor);
  } catch (error) {
    next(error);
  }
};

export const getEstadisticasProfesor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profesorId = Number(id);

    const [totalCitas, citasCompletadas, citasCanceladas, citasAgendadas] = await Promise.all([
      prisma.cita.count({ where: { profesorId } }),
      prisma.cita.count({ where: { profesorId, estado: "completada" } }),
      prisma.cita.count({ where: { profesorId, estado: "cancelada" } }),
      prisma.cita.count({ where: { profesorId, estado: "agendada" } }),
    ]);

    return ok(res, {
      total: totalCitas,
      completadas: citasCompletadas,
      canceladas: citasCanceladas,
      pendientes: citasAgendadas,
    });
  } catch (error) {
    next(error);
  }
};
