-- Add the column first (nullable, no default), then backfill, then enforce constraints.
ALTER TABLE "sites" ADD COLUMN "layout" text;

-- Backfill existing rows to the default value
UPDATE "sites" SET "layout" = 'sidebar-dropdown' WHERE "layout" IS NULL OR "layout" = '';

-- Set default for new rows
ALTER TABLE "sites" ALTER COLUMN "layout" SET DEFAULT 'sidebar-dropdown';

-- Enforce NOT NULL after backfill
ALTER TABLE "sites" ALTER COLUMN "layout" SET NOT NULL;
