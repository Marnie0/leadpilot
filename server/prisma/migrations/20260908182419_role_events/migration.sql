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
--
-- These two indexes exist only on databases that were developed against with
-- `db push` before the roles migration was written by hand. On a database that
-- has only ever seen migrations they do not exist yet — this migration runs
-- *before* the one that creates them — and an unguarded DROP fails the whole
-- migration, which is exactly what it did on production. The later migration
-- creates them for real, and the schema declares them.
DROP INDEX IF EXISTS "invitations_roleId_idx";
DROP INDEX IF EXISTS "users_roleId_idx";
