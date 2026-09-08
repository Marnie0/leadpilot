-- Index the role foreign keys.
--
-- Postgres does not index a foreign key for you, and both of these are read on
-- every role deletion: counting what holds a role, and moving those rows to the
-- destination. They are created idempotently because the two databases reached
-- this point by different routes — the development branch had them dropped by
-- an earlier migration, production never had them at all — and the schema now
-- declares them, so this is what makes the two agree.
CREATE INDEX IF NOT EXISTS "users_roleId_idx" ON "users" ("roleId");
CREATE INDEX IF NOT EXISTS "invitations_roleId_idx" ON "invitations" ("roleId");
