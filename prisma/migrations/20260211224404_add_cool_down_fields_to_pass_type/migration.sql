-- CreateEnum
CREATE TYPE "PassCoolDownUnit" AS ENUM ('HOUR', 'DAY', 'WEEK');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "eligibleFrom" TIMESTAMP(3),
ADD COLUMN     "eligibleUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PassType" ADD COLUMN     "coolDownPeriod" INTEGER,
ADD COLUMN     "coolDownReset" "PassCoolDownUnit",
ADD COLUMN     "coolDownResetOffset" INTEGER,
ADD COLUMN     "coolDownUnit" "PassCoolDownUnit";
