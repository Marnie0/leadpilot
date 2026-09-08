-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceEventType" ADD VALUE 'ROLE_CREATED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'ROLE_UPDATED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'ROLE_DELETED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'ACCOUNT_DELETED';

-- DropIndex
DROP INDEX "invitations_roleId_idx";

-- DropIndex
DROP INDEX "users_roleId_idx";
