/*
  Warnings:

  - The `estado` column on the `Cita` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[profesorId,fecha,horaInicio]` on the table `Cita` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `horaFin` to the `Cita` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horaInicio` to the `Cita` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('agendada', 'cancelada', 'completada');

-- AlterTable
ALTER TABLE "Cita" ADD COLUMN     "horaFin" TEXT NOT NULL,
ADD COLUMN     "horaInicio" TEXT NOT NULL,
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoCita" NOT NULL DEFAULT 'agendada';

-- CreateIndex
CREATE UNIQUE INDEX "Cita_profesorId_fecha_horaInicio_key" ON "Cita"("profesorId", "fecha", "horaInicio");
