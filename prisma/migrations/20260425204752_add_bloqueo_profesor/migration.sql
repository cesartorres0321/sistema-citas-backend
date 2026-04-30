-- CreateTable
CREATE TABLE "BloqueProfesor" (
    "id" SERIAL NOT NULL,
    "profesorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloqueProfesor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BloqueProfesor_profesorId_fecha_key" ON "BloqueProfesor"("profesorId", "fecha");

-- AddForeignKey
ALTER TABLE "BloqueProfesor" ADD CONSTRAINT "BloqueProfesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
