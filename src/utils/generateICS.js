export const generateICS = (cita, profesor, alumno) => {
  const fecha = cita.fecha.toISOString().split("T")[0].replace(/-/g, "");
  const inicio = cita.horaInicio.replace(":", "") + "00";
  const fin = cita.horaFin.replace(":", "") + "00";
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sistema de Citas//ES",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:cita-${cita.id}@sistema-citas`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/Mexico_City:${fecha}T${inicio}`,
    `DTEND;TZID=America/Mexico_City:${fecha}T${fin}`,
    `SUMMARY:Cita: ${alumno.nombre} con Prof. ${profesor.nombre}`,
    `DESCRIPTION:${cita.motivo}`,
    `ORGANIZER;CN=Sistema de Citas:MAILTO:${process.env.EMAIL_USER}`,
    `ATTENDEE;CN=${alumno.nombre}:MAILTO:${alumno.email}`,
    `ATTENDEE;CN=${profesor.nombre}:MAILTO:${profesor.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};
