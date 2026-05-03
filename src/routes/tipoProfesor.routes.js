import { Router } from "express";
import { body, param } from "express-validator";
import { verifyToken, authorizeRole } from "../middlewares/auth.middleware.js";
import { validateFields } from "../middlewares/validator.middleware.js";
import { getTipos, createTipo, deleteTipo } from "../controllers/tipoProfesor.controller.js";

const router = Router();

router.get("/", getTipos);

router.post(
  "/",
  verifyToken,
  authorizeRole("admin"),
  [
    body("nombre").trim().notEmpty().withMessage("El nombre es obligatorio"),
    validateFields,
  ],
  createTipo
);

router.delete(
  "/:id",
  verifyToken,
  authorizeRole("admin"),
  [
    param("id").isInt().withMessage("El ID debe ser un número"),
    validateFields,
  ],
  deleteTipo
);

export default router;
