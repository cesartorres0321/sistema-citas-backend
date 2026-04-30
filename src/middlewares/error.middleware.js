import { logger } from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { code: err.code, stack: err.stack });

  if (err.code === "P2002") {
    return res.status(400).json({ success: false, error: "Dato duplicado. Este valor ya existe." });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ success: false, error: "Registro no encontrado." });
  }

  if (err.code === "P2034") {
    return res.status(409).json({ success: false, error: "El horario acaba de ser reservado por otro usuario. Intenta con otro horario." });
  }

  res.status(500).json({ success: false, error: "Error interno del servidor" });
};
