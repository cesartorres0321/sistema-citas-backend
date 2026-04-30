import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import profesorRoutes from "./routes/profesor.routes.js";
import alumnoRoutes from "./routes/alumno.routes.js";
import citaRoutes from "./routes/cita.routes.js";
import authRoutes from "./routes/auth.routes.js";
import disponibilidadRoutes from "./routes/disponibilidad.routes.js";
import bloqueoRoutes from "./routes/bloqueo.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";

dotenv.config();

const app = express();



app.use(helmet());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

if (process.env.NODE_ENV !== "test") app.use(apiLimiter);
app.use("/auth", authRoutes);
app.use("/profesores", profesorRoutes);
app.use("/alumnos", alumnoRoutes);
app.use("/citas", citaRoutes);
app.use("/disponibilidad", disponibilidadRoutes);
app.use("/bloqueos", bloqueoRoutes);

app.use(errorHandler); 

export default app;