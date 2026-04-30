-- DropIndex
DROP INDEX "Cita_profesorId_fecha_horaInicio_key";

-- CreateIndex
CREATE INDEX "Cita_profesorId_fecha_horaInicio_idx" ON "Cita"("profesorId", "fecha", "horaInicio");
