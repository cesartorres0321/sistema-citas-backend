/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `password` to the `Alumno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Profesor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'alumno';

-- AlterTable
ALTER TABLE "Profesor" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'profesor';

-- DropTable
DROP TABLE "User";
