import { Router } from "express";
import {
  getAlumnos,
  createAlumno,
  updateAlumno,
  deleteAlumno,
} from "../controllers/alumno.controller.js";

import { body, param } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";
import { verifyToken, authorizeRole } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /alumnos:
 *   get:
 *     summary: Listar alumnos (admin y profesor)
 *     tags: [Alumnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de alumnos
 *       401:
 *         description: No autenticado
 */
router.get("/", verifyToken, authorizeRole("admin", "profesor"), getAlumnos);

/**
 * @swagger
 * /alumnos:
 *   post:
 *     summary: Crear alumno (solo admin)
 *     tags: [Alumnos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password, matricula]
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               matricula: { type: string }
 *     responses:
 *       201:
 *         description: Alumno creado
 *       400:
 *         description: Validación fallida o email duplicado
 */
router.post(
  "/",
  verifyToken,
  authorizeRole("admin"),
  [
    body("nombre").trim().notEmpty().withMessage("El nombre es obligatorio"),
    body("email").trim().normalizeEmail().isEmail().withMessage("Debe ser un email válido"),
    body("matricula").trim().notEmpty().withMessage("La matrícula es obligatoria"),
    validateFields,
  ],
  createAlumno
);

/**
 * @swagger
 * /alumnos/{id}:
 *   put:
 *     summary: Actualizar alumno (solo admin)
 *     tags: [Alumnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               matricula: { type: string }
 *     responses:
 *       200:
 *         description: Alumno actualizado
 *       404:
 *         description: Alumno no encontrado
 */
router.put(
  "/:id",
  verifyToken,
  authorizeRole("admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    body("nombre").optional().trim().stripLow(),
    body("email").optional().trim().normalizeEmail().isEmail().withMessage("Debe ser un email válido"),
    body("matricula").optional().trim().stripLow(),
    validateFields,
  ],
  updateAlumno
);

/**
 * @swagger
 * /alumnos/{id}:
 *   delete:
 *     summary: Eliminar alumno (solo admin)
 *     tags: [Alumnos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Alumno eliminado
 *       404:
 *         description: Alumno no encontrado
 */
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    validateFields,
  ],
  deleteAlumno
);

export default router;
