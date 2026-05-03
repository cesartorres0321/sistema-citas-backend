import { prisma } from "../config/prisma.js";
import { ok, created, err } from "../utils/apiResponse.js";

export const getTipos = async (req, res, next) => {
  try {
    const tipos = await prisma.tipoProfesor.findMany({
      orderBy: { nombre: "asc" },
    });
    return ok(res, tipos);
  } catch (error) {
    next(error);
  }
};

export const createTipo = async (req, res, next) => {
  try {
    const { nombre } = req.body;

    const existente = await prisma.tipoProfesor.findUnique({ where: { nombre } });
    if (existente) return err(res, "El tipo de profesor ya existe");

    const tipo = await prisma.tipoProfesor.create({ data: { nombre } });
    return created(res, tipo);
  } catch (error) {
    next(error);
  }
};

export const deleteTipo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const enUso = await prisma.profesor.findFirst({ where: { tipoId: Number(id) } });
    if (enUso) return err(res, "No se puede eliminar: hay profesores asignados a este tipo", 409);

    await prisma.tipoProfesor.delete({ where: { id: Number(id) } });
    return ok(res, null);
  } catch (error) {
    next(error);
  }
};
