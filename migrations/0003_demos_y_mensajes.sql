-- 0003 · Demos conceptuales y mensajes preparados (etapa 4)

-- ─────────────────────────── Demos ───────────────────────────
-- Cada demo es una versión nueva. El enlace público es un token aleatorio de 256 bits.
-- Lo único que se puede modificar después es revocar el enlace (revoked_at).

CREATE TABLE demos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  token           text NOT NULL UNIQUE CHECK (length(token) >= 40),
  content         jsonb NOT NULL,
  created_by_type actor_type NOT NULL,
  created_by_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  UNIQUE (prospect_id, version)
);
CREATE INDEX demos_prospect_idx ON demos (prospect_id, version DESC);

CREATE FUNCTION demos_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La tabla demos es de solo agregado: no se permite DELETE';
  END IF;
  IF (NEW.id, NEW.prospect_id, NEW.version, NEW.token, NEW.content, NEW.created_by_type,
      NEW.created_by_id, NEW.created_at, NEW.expires_at)
     IS DISTINCT FROM
     (OLD.id, OLD.prospect_id, OLD.version, OLD.token, OLD.content, OLD.created_by_type,
      OLD.created_by_id, OLD.created_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'Una demo no se modifica: se crea una versión nueva (solo se puede revocar el enlace)';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER demos_guard BEFORE UPDATE OR DELETE ON demos FOR EACH ROW EXECUTE FUNCTION demos_guard();

-- ─────────────────────────── Mensajes preparados ───────────────────────────
-- Asuntos, email HTML, texto y versiones por canal. El sistema nunca los envía.

CREATE TABLE outreach_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  demo_id         uuid REFERENCES demos(id),
  content         jsonb NOT NULL,
  created_by_type actor_type NOT NULL,
  created_by_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, version)
);
CREATE INDEX outreach_messages_prospect_idx ON outreach_messages (prospect_id, version DESC);

CREATE TRIGGER outreach_messages_append_only BEFORE UPDATE OR DELETE ON outreach_messages
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
