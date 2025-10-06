CREATE TABLE "site_search_keys" (
	"site_id" text NOT NULL,
	"key_value" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_search_keys_site_id_pk" PRIMARY KEY("site_id")
);
--> statement-breakpoint
ALTER TABLE "site_search_keys" ADD CONSTRAINT "site_search_keys_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;