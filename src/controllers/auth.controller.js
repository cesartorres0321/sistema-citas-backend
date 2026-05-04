import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import { ok, created, err } from "../utils/apiResponse.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const REFRESH_EXPIRY_DAYS = 7;
const refreshExpiresAt = () =>
  new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
};

const setRefreshCookie = (res, token) => res.cookie("refreshToken", token, COOKIE_OPTIONS);
const clearRefreshCookie = (res) => res.clearCookie("refreshToken", COOKIE_OPTIONS);

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user) return err(res, "Credenciales inválidas");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return err(res, "Credenciales inválidas");

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role, type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: `${REFRESH_EXPIRY_DAYS}d`, jwtid: randomUUID() }
    );

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: refreshExpiresAt(),
      },
    });

    setRefreshCookie(res, refreshToken);
    return ok(res, { token });
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const { nombre, email, password, matricula, departamentoId, tipoId, role } = req.body;

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) return err(res, "El usuario ya existe");

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === "profesor") {
      const { password: _, ...nuevo } = await prisma.usuario.create({
        data: {
          nombre, email, password: hashedPassword, role: "profesor",
          departamentoId: departamentoId ? Number(departamentoId) : undefined,
          tipoId: tipoId ? Number(tipoId) : undefined,
        },
      });
      return created(res, nuevo);
    }

    if (!matricula) return err(res, "La matrícula es obligatoria para alumnos");

    const { password: __, ...nuevo } = await prisma.usuario.create({
      data: { nombre, email, password: hashedPassword, matricula, role: "alumno" },
    });

    return created(res, nuevo);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) return err(res, "Sesión expirada, inicia sesión de nuevo", 401);

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (payload.type !== "refresh") return err(res, "Token inválido", 401);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });

    if (!stored || stored.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return err(res, "Sesión expirada, inicia sesión de nuevo", 401);
    }

    const newRefreshToken = jwt.sign(
      { id: payload.id, role: payload.role, type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: `${REFRESH_EXPIRY_DAYS}d`, jwtid: randomUUID() }
    );

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({ where: { id: stored.id } });
      await tx.refreshToken.create({
        data: {
          tokenHash: hashToken(newRefreshToken),
          userId: stored.userId,
          expiresAt: refreshExpiresAt(),
        },
      });
    });

    const newToken = jwt.sign(
      { id: payload.id, role: payload.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    setRefreshCookie(res, newRefreshToken);
    return ok(res, { token: newToken });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      clearRefreshCookie(res);
      return err(res, "Sesión expirada, inicia sesión de nuevo", 401);
    }
    next(error);
  }
};

const PERFIL_PROFESOR_SELECT = {
  id: true, nombre: true, email: true, role: true, foto: true, createdAt: true,
  duracionCita: true,
  departamento: { select: { id: true, nombre: true } },
  tipo: { select: { id: true, nombre: true } },
};

const PERFIL_ALUMNO_SELECT = {
  id: true, nombre: true, email: true, matricula: true, role: true, foto: true, createdAt: true,
};

export const getPerfil = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    const select = role === "alumno" ? PERFIL_ALUMNO_SELECT : PERFIL_PROFESOR_SELECT;

    const usuario = await prisma.usuario.findUnique({ where: { id }, select });
    if (!usuario) return err(res, "Usuario no encontrado", 404);

    return ok(res, usuario);
  } catch (error) {
    next(error);
  }
};

export const updatePerfil = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const { nombre, foto } = req.body;

    if (foto && foto.length > 200_000) {
      return err(res, "La imagen es demasiado grande. Máximo 150 KB.");
    }

    const data = {};
    if (nombre?.trim()) data.nombre = nombre.trim();
    if (foto !== undefined) data.foto = foto;

    if (Object.keys(data).length === 0) return err(res, "No hay datos para actualizar");

    const select = role === "alumno" ? PERFIL_ALUMNO_SELECT : PERFIL_PROFESOR_SELECT;

    const usuario = await prisma.usuario.update({ where: { id }, data, select });
    return ok(res, usuario);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) return ok(res, null);

  try {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
    clearRefreshCookie(res);
    return ok(res, null);
  } catch (error) {
    next(error);
  }
};
