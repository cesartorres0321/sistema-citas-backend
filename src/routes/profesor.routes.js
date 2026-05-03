import { Router } from "express";
import { verifyToken, authorizeRole } from "../middlewares/auth.middleware.js";
import { body, param } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";

import {
  getProfesores,
  getProfesorById,
  createProfesor,
  updateProfesor,
  deleteProfesor,
  updateDuracionCita,
  getEstadisticasProfesor
} from "../controllers/profesor.controller.js";

const router = Router();

/**
 * @swagger
 * /profesores:
 *   get:
 *     summary: Listar profesores
 *     tags: [Profesores]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de profesores
 */
router.get("/", getProfesores);

/**
 * @swagger
 * /profesores/{id}:
 *   get:
 *     summary: Obtener profesor por ID
 *     tags: [Profesores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del profesor
 *       404:
 *         description: Profesor no encontrado
 */
router.get("/:id", getProfesorById);

/**
 * @swagger
 * /profesores:
 *   post:
 *     summary: Crear profesor (solo admin)
 *     tags: [Profesores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password]
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               departamentoId: { type: integer }
 *               tipoId: { type: integer }
 *     responses:
 *       201:
 *         description: Profesor creado
 *       400:
 *         description: Validación fallida o email duplicado
 *       403:
 *         description: Se requiere rol admin
 */
router.post(
  "/",
  verifyToken,
  authorizeRole("admin"),
  [
    body("nombre").trim().notEmpty().withMessage("El nombre es obligatorio"),
    body("email").trim().normalizeEmail().isEmail().withMessage("Debe ser un email válido"),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("departamentoId").optional().isInt({ min: 1 }).withMessage("departamentoId debe ser un número entero positivo"),
    body("tipoId").optional().isInt({ min: 1 }).withMessage("tipoId debe ser un número entero positivo"),
    validateFields,
  ],
  createProfesor
);

/**
 * @swagger
 * /profesores/{id}:
 *   put:
 *     summary: Actualizar profesor (solo admin)
 *     tags: [Profesores]
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
 *               departamentoId: { type: integer }
 *               tipoId: { type: integer }
 *     responses:
 *       200:
 *         description: Profesor actualizado
 *       404:
 *         description: Profesor no encontrado
 */
router.put(
  "/:id",
  verifyToken,
  authorizeRole("admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    body("nombre").optional().trim().stripLow(),
    body("email").optional().trim().normalizeEmail().isEmail().withMessage("Debe ser un email válido"),
    body("departamentoId").optional().isInt({ min: 1 }).withMessage("departamentoId debe ser un número entero positivo"),
    body("tipoId").optional().isInt({ min: 1 }).withMessage("tipoId debe ser un número entero positivo"),
    validateFields,
  ],
  updateProfesor
);

/**
 * @swagger
 * /profesores/{id}:
 *   delete:
 *     summary: Eliminar profesor (solo admin)
 *     tags: [Profesores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Profesor eliminado
 *       404:
 *         description: Profesor no encontrado
 */
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    validateFields,
  ],
  deleteProfesor
);

/**
 * @swagger
 * /profesores/duracion:
 *   patch:
 *     summary: Actualizar duración de cita del profesor autenticado
 *     tags: [Profesores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [duracionCita]
 *             properties:
 *               duracionCita:
 *                 type: integer
 *                 example: 45
 *     responses:
 *       200:
 *         description: Duración actualizada
 *       403:
 *         description: Solo profesores
 */
router.patch(
  "/duracion",
  verifyToken,
  authorizeRole("profesor"),
  updateDuracionCita
);

/**
 * @swagger
 * /profesores/{id}/estadisticas:
 *   get:
 *     summary: Estadísticas de citas del profesor
 *     tags: [Profesores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Totales por estado de cita
 */
router.get(
  "/:id/estadisticas",
  verifyToken,
  authorizeRole("profesor", "admin"),
  getEstadisticasProfesor
);

export default router;
