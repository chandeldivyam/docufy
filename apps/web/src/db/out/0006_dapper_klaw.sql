ALTER TABLE "site_domains" ALTER COLUMN "verified" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "api_spec_blob_key" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "api_path" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "api_method" text;
