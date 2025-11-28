CREATE TABLE "site_github_assets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"branch" text NOT NULL,
	"path" text NOT NULL,
	"sha" text NOT NULL,
	"blob_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_github_docs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"branch" text NOT NULL,
	"path" text NOT NULL,
	"sha" text NOT NULL,
	"content_blob_hash" text NOT NULL,
	"title" text NOT NULL,
	"headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plain" text DEFAULT '' NOT NULL,
	"size" integer NOT NULL,
	"kind" text DEFAULT 'page',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_github_assets" ADD CONSTRAINT "site_github_assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_github_docs" ADD CONSTRAINT "site_github_docs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_github_assets_site_branch_path_idx" ON "site_github_assets" USING btree ("site_id","branch","path");--> statement-breakpoint
CREATE UNIQUE INDEX "site_github_docs_site_branch_path_idx" ON "site_github_docs" USING btree ("site_id","branch","path");