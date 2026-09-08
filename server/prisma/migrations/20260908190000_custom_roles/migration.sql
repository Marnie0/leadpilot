-- ---------------------------------------------------------------------------
-- Roles become rows with real permissions.
--
-- Written by hand rather than generated, because the interesting part is the
-- backfill: every existing account has to land on a seeded role that grants
-- exactly what its old enum value granted, and the one-owner invariant has to
-- survive the column it was built on being dropped.
-- ---------------------------------------------------------------------------

CREATE TYPE "RoleKey" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TYPE "Permission" AS ENUM (
  'MANAGE_TEAM',
  'MANAGE_WORKSPACE',
  'CHANGE_CURRENCY',
  'EDIT_ALL_LEADS',
  'DELETE_LEADS',
  'MANAGE_AI'
);

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" "RoleKey",
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_organizationId_key_key" ON "roles" ("organizationId", "key");
CREATE INDEX "roles_organizationId_order_idx" ON "roles" ("organizationId", "order");

ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the three roles into every existing workspace. The permission sets
-- reproduce the hard-coded behaviour exactly: an admin could manage the team,
-- the workspace, every lead and the assistant, but not the currency.
INSERT INTO "roles" ("id", "organizationId", "key", "name", "nameAr", "permissions", "isSystem", "order", "updatedAt")
SELECT 'role_own_' || o."id", o."id", 'OWNER', 'Owner', 'المالك',
       ARRAY['MANAGE_TEAM','MANAGE_WORKSPACE','CHANGE_CURRENCY','EDIT_ALL_LEADS','DELETE_LEADS','MANAGE_AI']::"Permission"[],
       true, 0, now()
FROM "organizations" o;

INSERT INTO "roles" ("id", "organizationId", "key", "name", "nameAr", "permissions", "isSystem", "order", "updatedAt")
SELECT 'role_adm_' || o."id", o."id", 'ADMIN', 'Admin', 'مشرف',
       ARRAY['MANAGE_TEAM','MANAGE_WORKSPACE','EDIT_ALL_LEADS','DELETE_LEADS','MANAGE_AI']::"Permission"[],
       true, 1, now()
FROM "organizations" o;

INSERT INTO "roles" ("id", "organizationId", "key", "name", "nameAr", "permissions", "isSystem", "order", "updatedAt")
SELECT 'role_mem_' || o."id", o."id", 'MEMBER', 'Sales rep', 'مندوب مبيعات',
       ARRAY[]::"Permission"[], true, 2, now()
FROM "organizations" o;

-- Users: point at the seeded role matching their old enum value, and lift
-- ownership out into its own column.
ALTER TABLE "users" ADD COLUMN "roleId" TEXT;
ALTER TABLE "users" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" u
SET "roleId" = r."id",
    "isOwner" = (u."role" = 'OWNER')
FROM "roles" r
WHERE r."organizationId" = u."organizationId"
  AND r."key" = u."role"::text::"RoleKey";

-- Nothing may be left unassigned; a NULL here would become an unauthenticatable
-- account the moment the column goes NOT NULL.
UPDATE "users" u
SET "roleId" = r."id"
FROM "roles" r
WHERE u."roleId" IS NULL AND r."organizationId" = u."organizationId" AND r."key" = 'MEMBER';

ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The one-owner invariant moves from the enum column to the boolean, before the
-- column it depended on is dropped.
DROP INDEX IF EXISTS "users_one_owner_per_organization";
CREATE UNIQUE INDEX "users_one_owner_per_organization"
  ON "users" ("organizationId") WHERE "isOwner";

CREATE INDEX "users_roleId_idx" ON "users" ("roleId");

-- Invitations grant a role row too.
ALTER TABLE "invitations" ADD COLUMN "roleId" TEXT;

UPDATE "invitations" i
SET "roleId" = r."id"
FROM "roles" r
WHERE r."organizationId" = i."organizationId" AND r."key" = i."role"::text::"RoleKey";

UPDATE "invitations" i
SET "roleId" = r."id"
FROM "roles" r
WHERE i."roleId" IS NULL AND r."organizationId" = i."organizationId" AND r."key" = 'MEMBER';

ALTER TABLE "invitations" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "invitations_roleId_idx" ON "invitations" ("roleId");

-- Only now is the old representation safe to remove.
ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "invitations" DROP COLUMN "role";
DROP TYPE "UserRole";
