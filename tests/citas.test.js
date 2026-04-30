import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

vi.mock("../src/utils/sendEmail.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const TS = Date.now();

let alumnoId;
let profesorId;
let alumnoToken;
let citaId;

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const fechaCita = tomorrow.toISOString().split("T")[0];
const diaSemana = new Date(fechaCita).getDay();

beforeAll(async () => {
  const hashedPw = await bcrypt.hash("test1234", 10);

  const profesor = await prisma.profesor.create({
    data: {
      nombre: "Profesor Citas Test",
      email: `prof_${TS}@vitest.local`,
      password: hashedPw,
      departamento: "Matemáticas",
    },
  });
  profesorId = profesor.id;

  await prisma.disponibilidad.create({
    data: { profesorId, diaSemana, horaInicio: "08:00", horaFin: "18:00" },
  });

  const alumno = await prisma.alumno.create({
    data: {
      nombre: "Alumno Citas Test",
      email: `alum_${TS}@vitest.local`,
      password: hashedPw,
      matricula: `C${TS}`,
    },
  });
  alumnoId = alumno.id;

  const loginRes = await request(app).post("/auth/login").send({
    email: `alum_${TS}@vitest.local`,
    password: "test1234",
  });
  alumnoToken = loginRes.body.data.token;
});

afterAll(async () => {
  await prisma.cita.deleteMany({ where: { alumnoId } });
  await prisma.disponibilidad.deleteMany({ where: { profesorId } });
  await prisma.refreshToken.deleteMany({ where: { userId: alumnoId, userType: "alumno" } });
  await prisma.alumno.deleteMany({ where: { id: alumnoId } });
  await prisma.profesor.deleteMany({ where: { id: profesorId } });
  await prisma.$disconnect();
});

describe("POST /citas", () => {
  it("crea una cita correctamente", async () => {
    const res = await request(app)
      .post("/citas")
      .set("Authorization", `Bearer ${alumnoToken}`)
      .send({
        profesorId,
        fecha: fechaCita,
        horaInicio: "10:00",
        horaFin: "10:30",
        motivo: "Asesoría de prueba",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.estado).toBe("agendada");
    citaId = res.body.data.id;
  });

  it("rechaza doble-booking en el mismo horario", async () => {
    const res = await request(app)
      .post("/citas")
      .set("Authorization", `Bearer ${alumnoToken}`)
      .send({
        profesorId,
        fecha: fechaCita,
        horaInicio: "10:00",
        horaFin: "10:30",
        motivo: "Intento de duplicado",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rechaza cita en horario solapado", async () => {
    const res = await request(app)
      .post("/citas")
      .set("Authorization", `Bearer ${alumnoToken}`)
      .send({
        profesorId,
        fecha: fechaCita,
        horaInicio: "10:15",
        horaFin: "10:45",
        motivo: "Horario solapado",
      });

    expect(res.status).toBe(400);
  });

  it("rechaza cita sin autenticación", async () => {
    const res = await request(app).post("/citas").send({
      profesorId,
      fecha: fechaCita,
      horaInicio: "11:00",
      horaFin: "11:30",
      motivo: "Sin token",
    });
    expect(res.status).toBe(401);
  });

  it("rechaza fecha en el pasado", async () => {
    const res = await request(app)
      .post("/citas")
      .set("Authorization", `Bearer ${alumnoToken}`)
      .send({
        profesorId,
        fecha: "2020-01-01",
        horaInicio: "10:00",
        horaFin: "10:30",
        motivo: "Fecha pasada",
      });
    expect(res.status).toBe(400);
  });

  it("rechaza profesor inexistente", async () => {
    const res = await request(app)
      .post("/citas")
      .set("Authorization", `Bearer ${alumnoToken}`)
      .send({
        profesorId: 999999,
        fecha: fechaCita,
        horaInicio: "12:00",
        horaFin: "12:30",
        motivo: "Profesor falso",
      });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /citas/:id/cancelar", () => {
  it("cancela una cita correctamente", async () => {
    const res = await request(app)
      .patch(`/citas/${citaId}/cancelar`)
      .set("Authorization", `Bearer ${alumnoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estado).toBe("cancelada");
  });

  it("rechaza cancelar una cita ya cancelada", async () => {
    const res = await request(app)
      .patch(`/citas/${citaId}/cancelar`)
      .set("Authorization", `Bearer ${alumnoToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /citas/profesor/:profesorId/horarios-disponibles", () => {
  it("devuelve horarios disponibles para una fecha válida", async () => {
    const res = await request(app).get(
      `/citas/profesor/${profesorId}/horarios-disponibles?fecha=${fechaCita}`
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rechaza petición sin parámetro fecha", async () => {
    const res = await request(app).get(
      `/citas/profesor/${profesorId}/horarios-disponibles`
    );
    expect(res.status).toBe(400);
  });
});
