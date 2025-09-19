-- Stores Yjs document updates
CREATE TABLE "document_updates" (
    "id" bigserial PRIMARY KEY,
    "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
    "update" bytea NOT NULL
);
CREATE INDEX "document_updates_doc_id_idx" ON "document_updates" ("document_id");

-- Stores Yjs awareness (presence) updates
CREATE TABLE "document_awareness" (
    "client_id" text NOT NULL,
    "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
    "update" bytea NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY ("document_id", "client_id")
);

-- Function and trigger to clean up stale awareness states (e.g., closed tabs)
CREATE OR REPLACE FUNCTION gc_awareness_timeouts()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM document_awareness
    WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') AND document_id = NEW.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gc_awareness_timeouts_trigger
AFTER INSERT OR UPDATE ON document_awareness
FOR EACH ROW
EXECUTE FUNCTION gc_awareness_timeouts();