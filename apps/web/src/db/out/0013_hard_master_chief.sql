ALTER TABLE "documents" ADD COLUMN "api_tag" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "managed_by_spec" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_api_tag_source_unique" ON "documents" USING btree ("api_tag","spec_source_id") WHERE "documents"."api_tag" IS NOT NULL AND "documents"."spec_source_id" IS NOT NULL;