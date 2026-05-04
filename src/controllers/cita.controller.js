import { prisma } from "../config/prisma.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateICS } from "../utils/generateICS.js";
import { logger } from "../utils/logger.js";
import { ok, created, paginated, err } from "../utils/apiResponse.js";

const autoCompletarPasadas = () => {
  // Comparar contra inicio del día en UTC para evitar falsos positivos por timezone
  // Las fechas se guardan como medianoche UTC, así que "< hoy UTC" = solo días anteriores
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  return prisma.cita.updateMany({
    where: { estado: "agendada", fecha: { lt: hoy } },
    data: { estado: "completada" },
  }).catch(() => {});
};

export const getCitas = async (req, res, next) => {
  try {
    await autoCompletarPasadas();
    const { role, id } = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const { estado, fechaInicio, fechaFin } = req.query;

    const where = {};
    if (role === "profesor") where.profesorId = id;
    else if (role === "alumno") where.alumnoId = id;

    if (estado) {
      if (!["agendada", "cancelada", "completada"].includes(estado)) {
        return err(res, "estado debe ser agendada, cancelada o completada");
      }
      where.estado = estado;
    }

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        where.fecha.lte = fin;
      }
    }

    const include =
      role === "admin"
        ? {
            profesor: { select: { id: true, nombre: true, email: true } },
            alumno: { select: { id: true, nombre: true, email: true } },
          }
        : role === "profesor"
        ? { alumno: { select: { id: true, nombre: true, email: true } } }
        : { profesor: { select: { id: true, nombre: true, email: true } } };

    const [citas, total] = await Promise.all([
      prisma.cita.findMany({ where, include, skip, take: limit, orderBy: { fecha: "asc" } }),
      prisma.cita.count({ where }),
    ]);

    return paginated(res, citas, total, page, Math.ceil(total / limit));

  } catch (error) {
    next(error);
  }
};

export const createCita = async (req, res, next) => {
  try {

    const { fecha, horaInicio, horaFin, motivo, profesorId } = req.body;
    const { role, id: alumnoId } = req.user;

    if (role !== "alumno") return err(res, "Solo los alumnos pueden crear citas", 403);

    const fechaConvertida = new Date(fecha);

    const profesor = await prisma.usuario.findFirst({
      where: { id: Number(profesorId), role: { in: ["profesor", "admin"] } },
    });

    if (!profesor) return err(res, "El profesor no existe", 404);

    // Día de la semana en UTC para evitar desfase por timezone del servidor
    const diaSemana = fechaConvertida.getUTCDay();

    const disponibilidad = await prisma.disponibilidad.findFirst({
      where: {
        profesorId: Number(profesorId),
        diaSemana
      }
    });

    if (!disponibilidad) return err(res, "El profesor no tiene disponibilidad ese día");

    // Verificar si el día está bloqueado por el profesor
    const bloqueo = await prisma.bloqueProfesor.findFirst({
      where: {
        profesorId: Number(profesorId),
        fecha: new Date(fecha + "T00:00:00.000Z"),
      }
    });

    if (bloqueo) return err(res, "El profesor no está disponible ese día");

    if (horaInicio < disponibilidad.horaInicio || horaFin > disponibilidad.horaFin) {
      return err(res, "La cita está fuera del horario disponible del profesor");
    }

    // rango del día para evitar problemas de timezone
    const inicioDia = new Date(fechaConvertida);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fechaConvertida);
    finDia.setHours(23, 59, 59, 999);

    // verificar conflicto y crear cita en una transacción atómica para evitar doble-booking
    let cita;
    try {
      cita = await prisma.$transaction(async (tx) => {
        const conflicto = await tx.cita.findFirst({
          where: {
            profesorId: Number(profesorId),
            estado: "agendada",
            fecha: { gte: inicioDia, lte: finDia },
            AND: [
              { horaInicio: { lt: horaFin } },
              { horaFin: { gt: horaInicio } },
            ],
          },
        });

        if (conflicto) {
          const err = new Error("Ese horario ya está ocupado");
          err.statusCode = 400;
          throw err;
        }

        return tx.cita.create({
          data: {
            fecha: fechaConvertida,
            horaInicio,
            horaFin,
            motivo,
            profesorId: Number(profesorId),
            alumnoId,
          },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error.statusCode) {
        return err(res, error.message, error.statusCode);
      }
      return next(error);
    }

    const alumno = await prisma.usuario.findUnique({ where: { id: alumnoId } });

    // Email con archivo .ics adjunto y link a Google Calendar
    try {
      const icsContent = generateICS(cita, profesor, alumno);
      const attachment = {
        filename: "cita.ics",
        content: icsContent,
        contentType: "text/calendar; method=REQUEST",
      };

      const fechaStr = cita.fecha.toISOString().split("T")[0].replace(/-/g, "");
      const inicioStr = horaInicio.replace(":", "") + "00";
      const finStr = horaFin.replace(":", "") + "00";
      const googleCalendarUrl =
        `https://www.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(`Cita: ${alumno.nombre} con Prof. ${profesor.nombre}`)}` +
        `&dates=${fechaStr}T${inicioStr}/${fechaStr}T${finStr}` +
        `&details=${encodeURIComponent(motivo)}` +
        `&add=${encodeURIComponent(profesor.email)},${encodeURIComponent(alumno.email)}`;

      const cuerpo = `Tu cita ha sido agendada correctamente.

Profesor: ${profesor.nombre}
Alumno: ${alumno.nombre}
Fecha: ${fecha}
Hora: ${horaInicio} - ${horaFin}
Motivo: ${motivo}

👉 Agregar a Google Calendar (un clic):
${googleCalendarUrl}

También puedes abrir el archivo adjunto (cita.ics) si usas Outlook o Apple Calendar.`;

      await sendEmail(alumno.email, "Confirmación de cita", cuerpo, [attachment]);
      await sendEmail(profesor.email, `Nueva cita: ${alumno.nombre}`, cuerpo, [attachment]);
    } catch (error) {
      logger.error("Error enviando email de confirmación", { error: error.message });
    }

    return created(res, cita);

  } catch (error) {
    next(error);
  }
};

export const getHorariosDisponibles = async (req, res, next) => {
  try {
    const { profesorId } = req.params;
    const { fecha } = req.query;

    if (!fecha) return err(res, "Debe enviar una fecha");

    const fechaConvertida = new Date(fecha);

    const profesor = await prisma.usuario.findFirst({
      where: { id: Number(profesorId), role: { in: ["profesor", "admin"] } },
    });
    if (!profesor) return err(res, "Profesor no encontrado", 404);

    const diaSemana = fechaConvertida.getUTCDay();

    const disponibilidad = await prisma.disponibilidad.findFirst({
      where: {
        profesorId: Number(profesorId),
        diaSemana
      }
    });

    if (!disponibilidad) {
      return ok(res, []);
    }

    const bloqueo = await prisma.bloqueProfesor.findFirst({
      where: {
        profesorId: Number(profesorId),
        fecha: new Date(fecha + "T00:00:00.000Z"),
      }
    });

    if (bloqueo) {
      return ok(res, []);
    }

    const inicioDia = new Date(fechaConvertida);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fechaConvertida);
    finDia.setHours(23, 59, 59, 999);

    const citas = await prisma.cita.findMany({
      where: {
        profesorId: Number(profesorId),
        fecha: {
          gte: inicioDia,
          lte: finDia
        },
        estado: "agendada"
      },
      select: {
        horaInicio: true
      }
    });

    const citasOcupadas = citas.map(c => c.horaInicio);

    const horarios = [];

    let horaActual = disponibilidad.horaInicio;

    const ahora = new Date();

    while (horaActual < disponibilidad.horaFin) {

      const [h, m] = horaActual.split(":").map(Number);

      const horarioDate = new Date(fechaConvertida);
      horarioDate.setHours(h);
      horarioDate.setMinutes(m);
      horarioDate.setSeconds(0);

      const nextDate = new Date(fechaConvertida);
      nextDate.setHours(h);
      nextDate.setMinutes(m + profesor.duracionCita);

      const horaFin =
        String(nextDate.getHours()).padStart(2, "0") +
        ":" +
        String(nextDate.getMinutes()).padStart(2, "0");

      if (horarioDate > ahora && !citasOcupadas.includes(horaActual)) {
        horarios.push({ horaInicio: horaActual, horaFin });
      }

      horaActual = horaFin;
    }

    return ok(res, horarios);

  } catch (error) {
    next(error);
  }
};

export const cancelarCita = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const cita = await prisma.cita.findUnique({
      where: { id: Number(id) },
      include: {
        alumno: { select: { nombre: true, email: true } },
        profesor: { select: { nombre: true, email: true } },
      },
    });

    if (!cita) return err(res, "Cita no encontrada", 404);
    if (cita.estado === "cancelada") return err(res, "La cita ya está cancelada");
    if (role !== "admin" && new Date(cita.fecha) < new Date()) return err(res, "No se puede cancelar una cita que ya ocurrió");
    if (role !== "admin" && cita.alumnoId !== userId && cita.profesorId !== userId) {
      return err(res, "No tienes permiso para cancelar esta cita", 403);
    }

    const citaCancelada = await prisma.cita.update({
      where: { id: Number(id) },
      data: { estado: "cancelada" }
    });

    try {
      const fechaStr = cita.fecha.toISOString().split("T")[0];
      const cuerpo = `Tu cita ha sido cancelada.

Profesor: ${cita.profesor.nombre}
Alumno: ${cita.alumno.nombre}
Fecha: ${fechaStr}
Hora: ${cita.horaInicio} - ${cita.horaFin}
Motivo: ${cita.motivo}`;

      await sendEmail(cita.alumno.email, "Cita cancelada", cuerpo);
      await sendEmail(cita.profesor.email, `Cita cancelada: ${cita.alumno.nombre}`, cuerpo);
    } catch (err) {
      logger.error("Error enviando email de cancelación", { error: err.message });
    }

    return ok(res, citaCancelada);

  } catch (error) {
    next(error);
  }
};

export const reprogramarCita = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha, horaInicio, horaFin } = req.body;
    const { role, id: userId } = req.user;

    const cita = await prisma.cita.findUnique({
      where: { id: Number(id) },
      include: {
        alumno: { select: { nombre: true, email: true } },
        profesor: { select: { nombre: true, email: true } },
      },
    });

    if (!cita) return err(res, "Cita no encontrada", 404);
    if (cita.estado === "cancelada") return err(res, "No se puede reprogramar una cita cancelada");
    if (role !== "admin" && cita.alumnoId !== userId && cita.profesorId !== userId) {
      return err(res, "No tienes permiso para reprogramar esta cita", 403);
    }

    const nuevaFecha = new Date(fecha);
    if (nuevaFecha <= new Date()) return err(res, "La nueva fecha debe ser futura");

    const inicioDia = new Date(nuevaFecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(nuevaFecha);
    finDia.setHours(23, 59, 59, 999);

    let citaActualizada;
    try {
      citaActualizada = await prisma.$transaction(async (tx) => {
        const conflicto = await tx.cita.findFirst({
          where: {
            profesorId: cita.profesorId,
            estado: "agendada",
            id: { not: Number(id) },
            fecha: { gte: inicioDia, lte: finDia },
            AND: [
              { horaInicio: { lt: horaFin } },
              { horaFin: { gt: horaInicio } },
            ],
          },
        });

        if (conflicto) {
          const err = new Error("El profesor ya tiene una cita en ese horario");
          err.statusCode = 400;
          throw err;
        }

        return tx.cita.update({
          where: { id: Number(id) },
          data: { fecha: nuevaFecha, horaInicio, horaFin },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error.statusCode) {
        return err(res, error.message, error.statusCode);
      }
      return next(error);
    }

    try {
      const icsContent = generateICS(citaActualizada, cita.profesor, cita.alumno);
      const attachment = {
        filename: "cita-reprogramada.ics",
        content: icsContent,
        contentType: "text/calendar; method=REQUEST",
      };

      const fechaStr = citaActualizada.fecha.toISOString().split("T")[0].replace(/-/g, "");
      const googleCalendarUrl =
        `https://www.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(`Cita: ${cita.alumno.nombre} con Prof. ${cita.profesor.nombre}`)}` +
        `&dates=${fechaStr}T${horaInicio.replace(":", "")}00/${fechaStr}T${horaFin.replace(":", "")}00` +
        `&details=${encodeURIComponent(cita.motivo)}` +
        `&add=${encodeURIComponent(cita.profesor.email)},${encodeURIComponent(cita.alumno.email)}`;

      const nuevaFechaStr = citaActualizada.fecha.toISOString().split("T")[0];
      const cuerpo = `Tu cita ha sido reprogramada.

Profesor: ${cita.profesor.nombre}
Alumno: ${cita.alumno.nombre}
Nueva fecha: ${nuevaFechaStr}
Nueva hora: ${horaInicio} - ${horaFin}
Motivo: ${cita.motivo}

👉 Agregar al calendario (nueva hora):
${googleCalendarUrl}

También puedes abrir el archivo adjunto (cita-reprogramada.ics).`;

      await sendEmail(cita.alumno.email, "Cita reprogramada", cuerpo, [attachment]);
      await sendEmail(cita.profesor.email, `Cita reprogramada: ${cita.alumno.nombre}`, cuerpo, [attachment]);
    } catch (err) {
      logger.error("Error enviando email de reprogramación", { error: err.message });
    }

    return ok(res, citaActualizada);

  } catch (error) {
    next(error);
  }
};

export const completarCita = async (req, res, next) => {
  try {

    const { id } = req.params;
    const { role } = req.user;

    if (role !== "profesor" && role !== "admin") return err(res, "Solo los profesores o administradores pueden completar citas", 403);

    const cita = await prisma.cita.findUnique({ where: { id: Number(id) } });

    if (!cita) return err(res, "La cita no existe", 404);
    if (cita.estado === "cancelada") return err(res, "No se puede completar una cita cancelada");
    if (cita.estado === "completada") return err(res, "La cita ya está completada");

    const citaActualizada = await prisma.cita.update({
      where: {
        id: Number(id)
      },
      data: {
        estado: "completada"
      }
    });

    return ok(res, citaActualizada);

  } catch (error) {
    next(error);
  }
};

export const getCalendarioProfesor = async (req, res, next) => {
  try {
    await autoCompletarPasadas();
    const { profesorId } = req.params;
    const { mes, anio } = req.query;

    if (!mes || !anio) return err(res, "Debe enviar mes y año");

    const fechaInicio = new Date(anio, mes - 1, 1);
    const fechaFin = new Date(anio, mes, 0, 23, 59, 59);

    const citas = await prisma.cita.findMany({
      where: {
        profesorId: Number(profesorId),
        fecha: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: {
        alumno: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      },
      orderBy: [
        { fecha: "asc" },
        { horaInicio: "asc" }
      ]
    });

    return ok(res, citas);

  } catch (error) {
    next(error);
  }
};

export const getAgendaDiaProfesor = async (req, res, next) => {
  try {
    await autoCompletarPasadas();
    const { profesorId } = req.params;
    const { fecha } = req.query;

    if (!fecha) return err(res, "Debe enviar una fecha");

    const fechaConvertida = new Date(fecha);

    const inicioDia = new Date(fechaConvertida);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fechaConvertida);
    finDia.setHours(23, 59, 59, 999);

    const citas = await prisma.cita.findMany({
      where: {
        profesorId: Number(profesorId),
        fecha: {
          gte: inicioDia,
          lte: finDia
        }
      },
      include: {
        alumno: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        horaInicio: "asc"
      }
    });

    return ok(res, citas);

  } catch (error) {
    next(error);
  }
};