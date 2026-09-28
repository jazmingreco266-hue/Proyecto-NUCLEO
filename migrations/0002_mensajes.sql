-- 0002 · Mensajes comerciales preparados para cada prospecto.
-- Cada guardado crea una versión nueva: nunca se sobrescribe un mensaje.

CREATE TYPE message_status AS ENUM ('draft', 'sent');

CREATE TABLE outreach_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id        uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version            integer NOT NULL CHECK (version > 0),
  status             message_status NOT NULL DEFAULT 'draft',
  subjects           text[] NOT NULL CHECK (cardinality(subjects) BETWEEN 1 AND 5),
  email_text         text NOT NULL,
  email_html         text NOT NULL,
  whatsapp_text      text NOT NULL,
  form_text          text NOT NULL,
  social_text        text NOT NULL,
  suggested_channel  text NOT NULL,
  channel_reason     text NOT NULL,
  best_time          text NOT NULL,
  -- Lo que se usó para escribirlo (qué dijo el equipo o el agente), para poder auditarlo.
  inputs             jsonb NOT NULL DEFAULT '{}',
  created_by_type    actor_type NOT NULL,
  created_by_id      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz,
  UNIQUE (prospect_id, version),
  CONSTRAINT sent_has_date CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);
CREATE INDEX outreach_messages_prospect_idx ON outreach_messages (prospect_id, version DESC);

-- El contenido de una versión no se edita. Solo se permite marcarla como enviada.
CREATE FUNCTION outreach_content_is_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los mensajes no se borran: se crea una versión nueva';
  END IF;
  IF (NEW.subjects, NEW.email_text, NEW.email_html, NEW.whatsapp_text, NEW.form_text, NEW.social_text,
      NEW.suggested_channel, NEW.channel_reason, NEW.best_time, NEW.inputs, NEW.version, NEW.prospect_id)
     IS DISTINCT FROM
     (OLD.subjects, OLD.email_text, OLD.email_html, OLD.whatsapp_text, OLD.form_text, OLD.social_text,
      OLD.suggested_channel, OLD.channel_reason, OLD.best_time, OLD.inputs, OLD.version, OLD.prospect_id) THEN
    RAISE EXCEPTION 'El contenido de un mensaje guardado no se edita: se crea una versión nueva';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER outreach_messages_frozen BEFORE UPDATE OR DELETE ON outreach_messages
  FOR EACH ROW EXECUTE FUNCTION outreach_content_is_frozen();
