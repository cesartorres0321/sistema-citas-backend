import { prisma } from "../config/prisma.js";
import { ok, created, err } from "../utils/apiResponse.js";

export const createBloqueo = async (req, res, next) => {
  try {
    const { fecha, motivo } = req.body;
    const { id: profesorId } = req.user;

    const fechaNorm = new Date(fecha + "T00:00:00.000Z");
    const bloqueo = await prisma.bloqueProfesor.create({
      data: { profesorId, fecha: fechaNorm, motivo },
    });

    return created(res, bloqueo);
  } catch (error) {
    next(error);
  }
};

export const getBloqueos = async (req, res, next) => {
  try {
    const { profesorId } = req.params;

    const bloqueos = await prisma.bloqueProfesor.findMany({
      where: { profesorId: Number(profesorId) },
      orderBy: { fecha: "asc" },
    });

    return ok(res, bloqueos);
  } catch (error) {
    next(error);
  }
};

export const deleteBloqueo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: profesorId } = req.user;

    const bloqueo = await prisma.bloqueProfesor.findUnique({ where: { id: Number(id) } });
    if (!bloqueo) return err(res, "Bloqueo no encontrado", 404);
    if (role !== "admin" && bloqueo.profesorId !== profesorId) {
      return err(res, "No tienes permiso para eliminar este bloqueo", 403);
    }

    await prisma.bloqueProfesor.delete({ where: { id: Number(id) } });

    return ok(res, null);
  } catch (error) {
    next(error);
  }
};
