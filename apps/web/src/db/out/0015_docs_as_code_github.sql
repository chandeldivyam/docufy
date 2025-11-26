CREATE TABLE "github_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text NOT NULL,
	"private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_builds" ADD COLUMN "source_commit_sha" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "content_source" text DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_installation_id" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_repo_full_name" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_branch" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "github_config_path" text;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_github_installation_id_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;