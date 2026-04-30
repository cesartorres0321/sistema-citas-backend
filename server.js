import dotenv from "dotenv";
dotenv.config();

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET", "EMAIL_USER", "EMAIL_PASS"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Variables de entorno requeridas no configuradas: ${missing.join(", ")}`);
  process.exit(1);
}

import app from "./src/app.js";
import { prisma } from "./src/config/prisma.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} recibido — cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("Conexión a base de datos cerrada.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
