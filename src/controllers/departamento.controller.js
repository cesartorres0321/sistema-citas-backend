import { prisma } from "../config/prisma.js";
import { ok, created, err } from "../utils/apiResponse.js";

export const getDepartamentos = async (req, res, next) => {
  try {
    const departamentos = await prisma.departamento.findMany({
      orderBy: { nombre: "asc" },
    });
    return ok(res, departamentos);
  } catch (error) {
    next(error);
  }
};

export const createDepartamento = async (req, res, next) => {
  try {
    const { nombre } = req.body;

    const existente = await prisma.departamento.findUnique({ where: { nombre } });
    if (existente) return err(res, "El departamento ya existe");

    const departamento = await prisma.departamento.create({ data: { nombre } });
    return created(res, departamento);
  } catch (error) {
    next(error);
  }
};

export const deleteDepartamento = async (req, res, next) => {
  try {
    const { id } = req.params;

    const enUso = await prisma.profesor.findFirst({ where: { departamentoId: Number(id) } });
    if (enUso) return err(res, "No se puede eliminar: hay profesores asignados a este departamento", 409);

    await prisma.departamento.delete({ where: { id: Number(id) } });
    return ok(res, null);
  } catch (error) {
    next(error);
  }
};
