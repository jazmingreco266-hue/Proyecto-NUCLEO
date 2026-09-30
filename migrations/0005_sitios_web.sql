-- 0005 · Sitio web del cliente (etapa 5)
-- Solo para empresas que ya son clientes. Marca (logo, colores, fuentes) y textos los aporta el cliente,
-- con su autorización registrada. Todo es de solo agregado: cada cambio es una versión nueva.

-- Logo y fotos que entregó el cliente. Se validan tipo y tamaño antes de guardar.
CREATE TABLE brand_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('logo', 'foto')),
  mime            text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  width           integer NOT NULL CHECK (width > 0),
  height          integer NOT NULL CHECK (height > 0),
  bytes           bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 3145728),
  sha256          char(64) NOT NULL,
  alt             text NOT NULL DEFAULT '',
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_assets_prospect_idx ON brand_assets (prospect_id, created_at DESC);
CREATE TRIGGER brand_assets_append_only BEFORE UPDATE OR DELETE ON brand_assets
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Ficha del sitio: marca, textos y autorización. Versionada.
CREATE TABLE site_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  brand           jsonb NOT NULL,
  content         jsonb NOT NULL,
  authorization_note text NOT NULL CHECK (length(trim(authorization_note)) >= 5),
  created_by_type actor_type NOT NULL,
  created_by_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, version)
);
CREATE TRIGGER site_briefs_append_only BEFORE UPDATE OR DELETE ON site_briefs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Sitios generados: el HTML y CSS exactos de cada versión, con su control de calidad.
CREATE TABLE site_builds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  brief_id        uuid NOT NULL REFERENCES site_briefs(id),
  template        text NOT NULL,
  html            text NOT NULL,
  css             text NOT NULL,
  quality         jsonb NOT NULL,
  ready           boolean NOT NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, version)
);
CREATE TRIGGER site_builds_append_only BEFORE UPDATE OR DELETE ON site_builds
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
