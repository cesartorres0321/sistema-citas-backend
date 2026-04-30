import { Router } from "express";
import {
  getCitas,
  createCita,
} from "../controllers/cita.controller.js";
import { body } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getHorariosDisponibles } from "../controllers/cita.controller.js";
import {
  cancelarCita,
  reprogramarCita,
  completarCita,
  getAgendaDiaProfesor
} from "../controllers/cita.controller.js";
import { getCalendarioProfesor } from "../controllers/cita.controller.js";




const router = Router();


/**
 * @swagger
 * /citas:
 *   get:
 *     summary: Obtener citas del usuario
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de citas
 */
router.get("/", verifyToken, getCitas);

/**
 * @swagger
 * /citas/profesor/{profesorId}/horarios-disponibles:
 *   get:
 *     summary: Obtener horarios disponibles de un profesor
 *     tags: [Horarios]
 *     parameters:
 *       - in: path
 *         name: profesorId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *         example: 2026-03-20
 *     responses:
 *       200:
 *         description: Lista de horarios disponibles
 */
router.get(
  "/profesor/:profesorId/horarios-disponibles",
  getHorariosDisponibles
);

router.get(
  "/profesor/:profesorId/calendario",
  verifyToken,
  getCalendarioProfesor
);
router.get(
  "/profesor/:profesorId/dia",
  verifyToken,
  getAgendaDiaProfesor
);

/**
 * @swagger
 * /citas/{id}/cancelar:
 *   patch:
 *     summary: Cancelar una cita
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Cita cancelada
 */
router.patch(
  "/:id/cancelar",
  verifyToken,
  cancelarCita
);

/**
 * @swagger
 * /citas/{id}/reprogramar:
 *   patch:
 *     summary: Reprogramar una cita
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha:
 *                 type: string
 *                 example: 2026-03-25
 *               horaInicio:
 *                 type: string
 *                 example: "11:00"
 *               horaFin:
 *                 type: string
 *                 example: "11:30"
 *     responses:
 *       200:
 *         description: Cita reprogramada
 */
router.patch(
  "/:id/reprogramar",
  verifyToken,
  [
    body("fecha")
      .isISO8601()
      .withMessage("La fecha debe tener formato válido (ISO 8601)")
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error("La nueva fecha debe ser futura");
        }
        return true;
      }),

    body("horaInicio")
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("horaInicio debe tener formato HH:MM"),

    body("horaFin")
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("horaFin debe tener formato HH:MM")
      .custom((horaFin, { req }) => {
        if (horaFin <= req.body.horaInicio) {
          throw new Error("horaFin debe ser posterior a horaInicio");
        }
        return true;
      }),

    validateFields,
  ],
  reprogramarCita
);

router.patch(
  "/:id/completar",
  verifyToken,
  completarCita
);
/**
 * @swagger
 * /citas:
 *   post:
 *     summary: Crear una nueva cita
 *     tags: [Citas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profesorId:
 *                 type: integer
 *                 example: 2
 *               fecha:
 *                 type: string
 *                 example: 2026-03-20
 *               horaInicio:
 *                 type: string
 *                 example: "10:00"
 *               horaFin:
 *                 type: string
 *                 example: "10:30"
 *               motivo:
 *                 type: string
 *                 example: Asesoría proyecto
 *     responses:
 *       201:
 *         description: Cita creada
 */
router.post(
  "/",
  verifyToken,

  [
    body("profesorId")
      .isInt()
      .withMessage("El profesorId debe ser un número"),

    body("fecha")
      .isISO8601()
      .withMessage("La fecha debe tener formato válido (ISO 8601)")
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error("La fecha debe ser futura");
        }
        return true;
      }),

    body("horaInicio")
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("horaInicio debe tener formato HH:MM"),

    body("horaFin")
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("horaFin debe tener formato HH:MM")
      .custom((horaFin, { req }) => {
        if (horaFin <= req.body.horaInicio) {
          throw new Error("horaFin debe ser posterior a horaInicio");
        }
        return true;
      }),

    body("motivo")
      .trim()
      .stripLow()
      .notEmpty()
      .withMessage("El motivo es obligatorio")
      .isLength({ max: 500 })
      .withMessage("El motivo no puede superar 500 caracteres"),

    validateFields,
  ],

  createCita
);

export default router;