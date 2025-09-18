CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"space_id" text NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"icon_name" text,
	"rank" text NOT NULL,
	"type" text DEFAULT 'page' NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;

-- Order and sibling-uniqueness
CREATE INDEX "documents_space_parent_rank_idx"
  ON "documents" ("space_id","parent_id","rank");
--> statement-breakpoint
-- Enforce unique slug among siblings; treat NULL parent_id as ''
CREATE UNIQUE INDEX "documents_space_parent_slug_unique"
  ON "documents" ("space_id", COALESCE("parent_id",'') , "slug");
