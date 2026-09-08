-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceEventType" ADD VALUE 'OWNERSHIP_TRANSFERRED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'MEMBER_INVITED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'INVITE_ACCEPTED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'INVITE_REVOKED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'MEMBER_ROLE_CHANGED';
ALTER TYPE "WorkspaceEventType" ADD VALUE 'MEMBER_REMOVED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "auth_tokens_expiresAt_idx" ON "auth_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_acceptedById_key" ON "invitations"("acceptedById");

-- CreateIndex
CREATE INDEX "invitations_organizationId_createdAt_idx" ON "invitations"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invitations_expiresAt_idx" ON "invitations"("expiresAt");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Exactly one owner per workspace.
--
-- The application has always talked about "the owner" while the schema allowed
-- any number of them, and the guards counted *other* owners to decide whether a
-- demotion was safe. That ambiguity is reachable: two demo sandboxes in the dev
-- database had picked up a second owner through ordinary role changes.
--
-- Ownership is now transferred rather than granted, so the invariant is real
-- and belongs in the database, where a bug in a future guard cannot violate it.
-- Existing extras are demoted to ADMIN — the *earliest* account keeps the role,
-- since that is the one that created the workspace — and only then is the
-- constraint added, so the migration cannot fail on live data.
-- ---------------------------------------------------------------------------
UPDATE "users" u
SET "role" = 'ADMIN'
WHERE u."role" = 'OWNER'
  AND u."id" <> (
    SELECT o."id"
    FROM "users" o
    WHERE o."organizationId" = u."organizationId" AND o."role" = 'OWNER'
    ORDER BY o."createdAt" ASC, o."id" ASC
    LIMIT 1
  );

-- Partial unique index: Prisma cannot express "unique where role = OWNER", and
-- a plain unique on organizationId would forbid a second member entirely.
CREATE UNIQUE INDEX "users_one_owner_per_organization"
  ON "users" ("organizationId")
  WHERE "role" = 'OWNER';
