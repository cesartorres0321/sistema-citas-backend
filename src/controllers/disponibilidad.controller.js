import { prisma } from "../config/prisma.js";
import { ok, created, err } from "../utils/apiResponse.js";

export const createDisponibilidad = async (req, res, next) => {
  try {
    const { diaSemana, horaInicio, horaFin } = req.body;
    const { role, id: profesorId } = req.user;

    if (role !== "profesor") return err(res, "Solo los profesores pueden crear disponibilidades", 403);
    if (diaSemana < 0 || diaSemana > 6) return err(res, "diaSemana debe estar entre 0 (domingo) y 6 (sábado)");
    if (!horaInicio || !horaFin) return err(res, "Debe indicar horaInicio y horaFin");

    const disponibilidad = await prisma.disponibilidad.create({
      data: { profesorId, diaSemana, horaInicio, horaFin },
    });

    return created(res, disponibilidad);
  } catch (error) {
    next(error);
  }
};

export const updateDisponibilidad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { diaSemana, horaInicio, horaFin } = req.body;
    const { role, id: profesorId } = req.user;

    const disponibilidad = await prisma.disponibilidad.findUnique({ where: { id: Number(id) } });
    if (!disponibilidad) return err(res, "Disponibilidad no encontrada", 404);
    if (role !== "admin" && disponibilidad.profesorId !== profesorId) {
      return err(res, "No tienes permiso para modificar esta disponibilidad", 403);
    }
    if (diaSemana !== undefined && (diaSemana < 0 || diaSemana > 6)) {
      return err(res, "diaSemana debe estar entre 0 (domingo) y 6 (sábado)");
    }

    const actualizada = await prisma.disponibilidad.update({
      where: { id: Number(id) },
      data: {
        ...(diaSemana !== undefined && { diaSemana }),
        ...(horaInicio && { horaInicio }),
        ...(horaFin && { horaFin }),
      },
    });

    return ok(res, actualizada);
  } catch (error) {
    next(error);
  }
};

export const deleteDisponibilidad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: profesorId } = req.user;

    const disponibilidad = await prisma.disponibilidad.findUnique({ where: { id: Number(id) } });
    if (!disponibilidad) return err(res, "Disponibilidad no encontrada", 404);
    if (role !== "admin" && disponibilidad.profesorId !== profesorId) {
      return err(res, "No tienes permiso para eliminar esta disponibilidad", 403);
    }

    await prisma.disponibilidad.delete({ where: { id: Number(id) } });

    return ok(res, null);
  } catch (error) {
    next(error);
  }
};

export const getDisponibilidadProfesor = async (req, res, next) => {
  try {
    const { profesorId } = req.params;

    const disponibilidades = await prisma.disponibilidad.findMany({
      where: { profesorId: Number(profesorId) },
      orderBy: { diaSemana: "asc" },
    });

    return ok(res, disponibilidades);
  } catch (error) {
    next(error);
  }
};
