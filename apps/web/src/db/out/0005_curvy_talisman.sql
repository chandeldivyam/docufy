CREATE TABLE "site_builds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"build_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text NOT NULL,
	"operation" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"selected_space_ids_snapshot" text NOT NULL,
	"target_build_id" text,
	"items_total" text DEFAULT 0 NOT NULL,
	"items_done" text DEFAULT 0 NOT NULL,
	"pages_written" text DEFAULT 0 NOT NULL,
	"bytes_written" text DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "site_content_blobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"hash" text NOT NULL,
	"key" text NOT NULL,
	"size" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"ref_count" text DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"domain" text NOT NULL,
	"organization_id" text NOT NULL,
	"verified" text DEFAULT false NOT NULL,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_spaces" (
	"site_id" text NOT NULL,
	"space_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"position" text NOT NULL,
	"style" text DEFAULT 'dropdown' NOT NULL,
	CONSTRAINT "site_spaces_site_id_space_id_pk" PRIMARY KEY("site_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"store_id" text NOT NULL,
	"base_url" text NOT NULL,
	"primary_host" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_build_id" text,
	"last_published_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "site_builds" ADD CONSTRAINT "site_builds_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_builds" ADD CONSTRAINT "site_builds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_builds" ADD CONSTRAINT "site_builds_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content_blobs" ADD CONSTRAINT "site_content_blobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_spaces" ADD CONSTRAINT "site_spaces_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_spaces" ADD CONSTRAINT "site_spaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_spaces" ADD CONSTRAINT "site_spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_builds_build_unique" ON "site_builds" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "site_builds_site_idx" ON "site_builds" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_blobs_org_hash_unique" ON "site_content_blobs" USING btree ("organization_id","hash");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_domain_unique" ON "site_domains" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_site_domain_unique" ON "site_domains" USING btree ("site_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_org_slug_unique" ON "sites" USING btree ("organization_id","slug");