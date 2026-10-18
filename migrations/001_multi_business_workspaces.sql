-- WorkHub multi-business foundation.
-- Review and take a verified database backup before applying this migration.
-- Run once against the intended database before deploying code that requires workspace_id.
BEGIN;

CREATE TABLE IF NOT EXISTS items (
  id text PRIMARY KEY,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_workspaces (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  principal_id text NOT NULL,
  workspace_id text NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, workspace_id)
);

INSERT INTO business_workspaces (id, slug, name, business_type, description, brand, modules)
VALUES
  ('ascendvista', 'ascendvista', 'AscendVista', 'Agency / Professional Services',
   'Technology, web development, digital growth and client services.', 'AV',
   '["overview","diary","calendar","goals","engagements","money","settings"]'::jsonb),
  ('bravestone-learning', 'bravestone-learning', 'Bravestone Learning', 'Education / Professional Development',
   'Professional and executive development programmes, online workshops and corporate training.', 'BL',
   '["overview","programmes","learners","instructors","calendar","marketing","money","tasks","reports","settings"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- The existing single-business account becomes the owner principal in both workspaces.
INSERT INTO workspace_memberships (principal_id, workspace_id, role)
VALUES ('owner', 'ascendvista', 'owner'), ('owner', 'bravestone-learning', 'owner')
ON CONFLICT (principal_id, workspace_id) DO NOTHING;

ALTER TABLE items ADD COLUMN IF NOT EXISTS workspace_id text;

-- Existing records belong to AscendVista. Preserve every id, JSON payload and created_at value.
UPDATE items SET workspace_id = 'ascendvista' WHERE workspace_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_workspace_id_fkey'
      AND conrelid = 'items'::regclass
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES business_workspaces(id);
  END IF;
END $$;

ALTER TABLE items ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS items_workspace_kind_created_idx
  ON items (workspace_id, kind, created_at DESC);

COMMIT;

-- Post-migration verification: AscendVista should contain all pre-existing rows;
-- the second query should return zero.
SELECT workspace_id, count(*) AS item_count FROM items GROUP BY workspace_id ORDER BY workspace_id;
SELECT count(*) AS unassigned_items FROM items WHERE workspace_id IS NULL;
