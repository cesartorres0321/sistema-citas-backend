import { Router } from "express";
import {
  createDisponibilidad,
  getDisponibilidadProfesor,
  updateDisponibilidad,
  deleteDisponibilidad,
} from "../controllers/disponibilidad.controller.js";

import { verifyToken, authorizeRole } from "../middlewares/auth.middleware.js";
import { param, body } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";

const horaValida = (campo) =>
  body(campo)
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage(`${campo} debe tener formato HH:MM`);

const router = Router();

/**
 * @swagger
 * /disponibilidad:
 *   post:
 *     summary: Crear disponibilidad semanal del profesor autenticado
 *     tags: [Disponibilidad]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [diaSemana, horaInicio, horaFin]
 *             properties:
 *               diaSemana:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 description: "0=domingo, 1=lunes, ..., 6=sábado"
 *                 example: 1
 *               horaInicio:
 *                 type: string
 *                 example: "09:00"
 *               horaFin:
 *                 type: string
 *                 example: "13:00"
 *     responses:
 *       201:
 *         description: Disponibilidad creada
 *       400:
 *         description: Validación fallida
 *       403:
 *         description: Solo profesores
 */
router.post(
  "/",
  verifyToken,
  authorizeRole("profesor"),
  [
    body("diaSemana")
      .isInt({ min: 0, max: 6 })
      .withMessage("diaSemana debe ser un número entre 0 (domingo) y 6 (sábado)"),
    horaValida("horaInicio"),
    horaValida("horaFin"),
    body("horaFin").custom((horaFin, { req }) => {
      if (horaFin <= req.body.horaInicio) {
        throw new Error("horaFin debe ser posterior a horaInicio");
      }
      return true;
    }),
    validateFields,
  ],
  createDisponibilidad
);

/**
 * @swagger
 * /disponibilidad/{profesorId}:
 *   get:
 *     summary: Ver disponibilidad semanal de un profesor
 *     tags: [Disponibilidad]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profesorId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de disponibilidades ordenadas por día
 */
router.get("/:profesorId", verifyToken, getDisponibilidadProfesor);

/**
 * @swagger
 * /disponibilidad/{id}:
 *   put:
 *     summary: Actualizar disponibilidad (profesor dueño o admin)
 *     tags: [Disponibilidad]
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
 *               diaSemana: { type: integer, minimum: 0, maximum: 6 }
 *               horaInicio: { type: string, example: "09:00" }
 *               horaFin: { type: string, example: "14:00" }
 *     responses:
 *       200:
 *         description: Disponibilidad actualizada
 *       403:
 *         description: Sin permiso
 *       404:
 *         description: No encontrada
 */
router.put(
  "/:id",
  verifyToken,
  authorizeRole("profesor", "admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    body("diaSemana").optional().isInt({ min: 0, max: 6 }).withMessage("diaSemana debe ser entre 0 y 6"),
    body("horaInicio").optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("horaInicio debe tener formato HH:MM"),
    body("horaFin")
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("horaFin debe tener formato HH:MM")
      .custom((horaFin, { req }) => {
        if (req.body.horaInicio && horaFin <= req.body.horaInicio) {
          throw new Error("horaFin debe ser posterior a horaInicio");
        }
        return true;
      }),
    validateFields,
  ],
  updateDisponibilidad
);

/**
 * @swagger
 * /disponibilidad/{id}:
 *   delete:
 *     summary: Eliminar disponibilidad (profesor dueño o admin)
 *     tags: [Disponibilidad]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Disponibilidad eliminada
 *       403:
 *         description: Sin permiso
 *       404:
 *         description: No encontrada
 */
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("profesor", "admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    validateFields,
  ],
  deleteDisponibilidad
);

export default router;
