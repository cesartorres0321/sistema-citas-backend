import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const TS = Date.now();
const EMAIL = `auth_${TS}@vitest.local`;
const PASSWORD = "test1234";

// Extrae el valor de una cookie del header set-cookie
const parseCookie = (res, name) => {
  const cookies = res.headers["set-cookie"] || [];
  for (const c of cookies) {
    const m = c.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
};

let alumnoId;
let accessToken;
let agent; // persiste cookies entre requests

beforeAll(async () => {
  agent = request.agent(app);

  const res = await agent.post("/auth/register").send({
    nombre: "Test Auth",
    email: EMAIL,
    password: PASSWORD,
    matricula: `MAT${TS}`,
    role: "alumno",
  });
  alumnoId = res.body.data?.id;
});

afterAll(async () => {
  if (alumnoId) {
    await prisma.refreshToken.deleteMany({ where: { userId: alumnoId, userType: "alumno" } });
  }
  await prisma.alumno.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("devuelve success:true y no expone el password", async () => {
    const res = await request(app).post("/auth/register").send({
      nombre: "Test Auth 2",
      email: `auth2_${TS}@vitest.local`,
      password: PASSWORD,
      matricula: `MAT${TS}B`,
      role: "alumno",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBeDefined();
    expect(res.body.data.password).toBeUndefined();
    await prisma.alumno.deleteMany({ where: { email: `auth2_${TS}@vitest.local` } });
  });

  it("rechaza email duplicado", async () => {
    const res = await request(app).post("/auth/register").send({
      nombre: "Duplicado",
      email: EMAIL,
      password: PASSWORD,
      matricula: `MAT${TS}DUP`,
      role: "alumno",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rechaza formato de email inválido", async () => {
    const res = await request(app).post("/auth/register").send({
      nombre: "Test",
      email: "noesunemail",
      password: PASSWORD,
      matricula: `MAT${TS}INV`,
      role: "alumno",
    });
    expect(res.status).toBe(400);
  });

  it("rechaza contraseña menor a 6 caracteres", async () => {
    const res = await request(app).post("/auth/register").send({
      nombre: "Test",
      email: `short_${TS}@vitest.local`,
      password: "123",
      matricula: `MAT${TS}SH`,
      role: "alumno",
    });
    expect(res.status).toBe(400);
  });

  it("rechaza rol inválido", async () => {
    const res = await request(app).post("/auth/register").send({
      nombre: "Test",
      email: `role_${TS}@vitest.local`,
      password: PASSWORD,
      matricula: `MAT${TS}ROL`,
      role: "admin",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("devuelve access token en body y refreshToken como cookie httpOnly", async () => {
    const res = await agent.post("/auth/login").send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    // refreshToken no debe estar en el body
    expect(res.body.data.refreshToken).toBeUndefined();
    // la cookie debe estar presente en el header
    expect(parseCookie(res, "refreshToken")).toBeTruthy();

    accessToken = res.body.data.token;
  });

  it("rechaza contraseña incorrecta", async () => {
    const res = await request(app).post("/auth/login").send({ email: EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rechaza usuario inexistente", async () => {
    const res = await request(app).post("/auth/login").send({
      email: `noexiste_${TS}@vitest.local`,
      password: PASSWORD,
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/refresh", () => {
  let oldCookieValue;

  it("emite nuevo access token y rota la cookie", async () => {
    // capturar el cookie actual antes de rotar
    const loginRes = await agent.post("/auth/login").send({ email: EMAIL, password: PASSWORD });
    oldCookieValue = parseCookie(loginRes, "refreshToken");

    // rotar — el agent envía automáticamente la cookie
    const res = await agent.post("/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    // la nueva cookie debe estar presente
    expect(parseCookie(res, "refreshToken")).toBeTruthy();
  });

  it("rechaza el token anterior después de la rotación", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${oldCookieValue}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rechaza petición sin cookie", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revoca la sesión y limpia la cookie", async () => {
    const res = await agent.post("/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // la cookie debe quedar con maxAge=0 (borrada)
    const cookie = (res.headers["set-cookie"] || []).find(c => c.startsWith("refreshToken="));
    expect(cookie).toMatch(/Max-Age=0|Expires=.*1970/i);
  });

  it("refresh después del logout devuelve 401", async () => {
    const res = await agent.post("/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("Rutas protegidas", () => {
  it("GET /citas rechaza petición sin token", async () => {
    const res = await request(app).get("/citas");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("GET /citas rechaza token inválido", async () => {
    const res = await request(app)
      .get("/citas")
      .set("Authorization", "Bearer token.invalido.aqui");
    expect(res.status).toBe(401);
  });
});
