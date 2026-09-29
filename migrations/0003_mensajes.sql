-- 0003 · Mensajes de contacto preparados (etapa 4)
-- Asuntos, email HTML, texto y versiones por canal. El sistema nunca los envía.
-- Cada preparación es una versión nueva: no se modifican ni se borran.

CREATE TABLE outreach_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  content         jsonb NOT NULL,
  created_by_type actor_type NOT NULL,
  created_by_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, version)
);
CREATE INDEX outreach_messages_prospect_idx ON outreach_messages (prospect_id, version DESC);

CREATE TRIGGER outreach_messages_append_only BEFORE UPDATE OR DELETE ON outreach_messages
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
