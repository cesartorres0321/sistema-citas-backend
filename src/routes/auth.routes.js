import { Router } from "express";
import { register, login, refresh, logout, getPerfil, updatePerfil } from "../controllers/auth.controller.js";
import { body } from "express-validator";
import { validateFields } from "../middlewares/validator.middleware.js";
import { loginLimiter } from "../middlewares/rateLimit.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar alumno o profesor
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password, role]
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 example: juan@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 enum: [alumno, profesor]
 *               matricula:
 *                 type: string
 *                 description: Requerido si role es alumno
 *               departamento:
 *                 type: string
 *                 description: Requerido si role es profesor
 *     responses:
 *       201:
 *         description: Usuario registrado
 *       400:
 *         description: Validación fallida o usuario ya existe
 */
router.post(
  "/register",
  [
    body("nombre").trim().notEmpty().withMessage("El nombre es obligatorio"),
    body("email").trim().normalizeEmail().isEmail().withMessage("Debe ser un email válido"),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("role")
      .trim()
      .isIn(["alumno", "profesor"])
      .withMessage("El rol debe ser alumno o profesor"),
    body("matricula").optional().trim().stripLow(),
    body("departamento").optional().trim().stripLow(),
    validateFields,
  ],
  register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: alumno@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso — devuelve token y refreshToken
 *       400:
 *         description: Credenciales inválidas
 */
router.post("/login", loginLimiter, login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acceso (usa cookie httpOnly refreshToken)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Nuevo token de acceso
 *       401:
 *         description: Sesión expirada o inválida
 */
router.post("/refresh", refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión (revoca cookie refreshToken)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
router.post("/logout", logout);

router.get("/perfil", verifyToken, getPerfil);

router.patch(
  "/perfil",
  verifyToken,
  [
    body("nombre").optional().trim().notEmpty().withMessage("El nombre no puede estar vacío"),
    body("foto").optional({ nullable: true }),
    validateFields,
  ],
  updatePerfil
);

export default router;
