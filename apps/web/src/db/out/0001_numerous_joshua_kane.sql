-- 1) Flattened table for Settings page and other org-scoped UIs
CREATE TABLE IF NOT EXISTS org_user_profiles (
  "organization_id" text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "user_id"         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "role"            text NOT NULL DEFAULT 'member',
  "name"            text,
  "email"           text,
  "image"           text,
  "created_at"      timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "org_user_profiles_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);

-- 2) Members triggers - keep org_user_profiles in sync
CREATE OR REPLACE FUNCTION trg_members_upsert_org_user_profiles() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO org_user_profiles (organization_id, user_id, role, name, email, image)
    SELECT NEW.organization_id, NEW.user_id, COALESCE(NEW.role, 'member'), u.name, u.email, u.image
    FROM users u WHERE u.id = NEW.user_id
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role  = EXCLUDED.role,
          name  = EXCLUDED.name,
          email = EXCLUDED.email,
          image = EXCLUDED.image;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE org_user_profiles
       SET role = COALESCE(NEW.role, 'member')
     WHERE organization_id = NEW.organization_id
       AND user_id         = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM org_user_profiles
     WHERE organization_id = OLD.organization_id
       AND user_id         = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_after_ins ON members;
DROP TRIGGER IF EXISTS members_after_upd ON members;
DROP TRIGGER IF EXISTS members_after_del ON members;

CREATE TRIGGER members_after_ins AFTER INSERT ON members
FOR EACH ROW EXECUTE FUNCTION trg_members_upsert_org_user_profiles();

CREATE TRIGGER members_after_upd AFTER UPDATE OF role, organization_id, user_id ON members
FOR EACH ROW EXECUTE FUNCTION trg_members_upsert_org_user_profiles();

CREATE TRIGGER members_after_del AFTER DELETE ON members
FOR EACH ROW EXECUTE FUNCTION trg_members_upsert_org_user_profiles();

-- 3) Users trigger - propagate profile changes
CREATE OR REPLACE FUNCTION trg_users_propagate_to_org_user_profiles() RETURNS TRIGGER AS $$
BEGIN
  UPDATE org_user_profiles
     SET name  = NEW.name,
         email = NEW.email,
         image = NEW.image
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_after_upd ON users;

CREATE TRIGGER users_after_upd AFTER UPDATE OF name, email, image ON users
FOR EACH ROW EXECUTE FUNCTION trg_users_propagate_to_org_user_profiles();
