import { Router } from "express";
import { createBloqueo, getBloqueos, deleteBloqueo } from "../controllers/bloqueo.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/auth.middleware.js";
import { body, param } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";

const router = Router();

/**
 * @swagger
 * /bloqueos:
 *   post:
 *     summary: Bloquear un día específico (vacaciones, festivo)
 *     tags: [Bloqueos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fecha]
 *             properties:
 *               fecha:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-10"
 *               motivo:
 *                 type: string
 *                 example: "Día festivo"
 *     responses:
 *       201:
 *         description: Día bloqueado
 *       400:
 *         description: Fecha inválida o ya bloqueada
 *       403:
 *         description: Solo profesores o admin
 */
router.post(
  "/",
  verifyToken,
  authorizeRole("profesor", "admin"),
  [
    body("fecha").trim().isISO8601().withMessage("La fecha debe tener formato válido (YYYY-MM-DD)"),
    body("motivo").optional().trim().stripLow().isLength({ max: 200 }).withMessage("El motivo no puede superar 200 caracteres"),
    validateFields,
  ],
  createBloqueo
);

/**
 * @swagger
 * /bloqueos/{profesorId}:
 *   get:
 *     summary: Ver días bloqueados de un profesor
 *     tags: [Bloqueos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profesorId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de bloqueos ordenados por fecha
 */
router.get("/:profesorId", verifyToken, getBloqueos);

/**
 * @swagger
 * /bloqueos/{id}:
 *   delete:
 *     summary: Eliminar bloqueo (profesor dueño o admin)
 *     tags: [Bloqueos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Bloqueo eliminado
 *       403:
 *         description: Sin permiso
 *       404:
 *         description: Bloqueo no encontrado
 */
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("profesor", "admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    validateFields,
  ],
  deleteBloqueo
);

export default router;
