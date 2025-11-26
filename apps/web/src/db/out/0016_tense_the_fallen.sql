CREATE TABLE "site_repo_syncs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"config_sha" text,
	"commit_sha" text,
	"branch" text,
	"config_path" text,
	"triggered_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_sha" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_error" text;--> statement-breakpoint
ALTER TABLE "site_repo_syncs" ADD CONSTRAINT "site_repo_syncs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_repo_syncs" ADD CONSTRAINT "site_repo_syncs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_repo_syncs_site_idx" ON "site_repo_syncs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_repo_syncs_org_idx" ON "site_repo_syncs" USING btree ("organization_id");