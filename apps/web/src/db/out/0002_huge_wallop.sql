CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "spaces_org_slug_unique"
  ON "spaces" ("organization_id", "slug");

-- Helpful filters for shapes
CREATE INDEX "spaces_org_idx" ON "spaces" ("organization_id");
CREATE INDEX "spaces_org_updated_idx" ON "spaces" ("organization_id","updated_at");