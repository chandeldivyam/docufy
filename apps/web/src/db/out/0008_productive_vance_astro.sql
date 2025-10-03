CREATE TABLE "site_themes" (
	"site_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"light_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dark_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_themes_site_id_pk" PRIMARY KEY("site_id")
);
--> statement-breakpoint
ALTER TABLE "site_themes" ADD CONSTRAINT "site_themes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_themes" ADD CONSTRAINT "site_themes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_themes_site_idx" ON "site_themes" USING btree ("site_id");