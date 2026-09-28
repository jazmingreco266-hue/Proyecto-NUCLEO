-- 0001 · Núcleo operativo de Claude Workers
-- Usuarios, sesiones, prospectos, hechos con fuente, pipeline, aprobaciones,
-- notas, configuración, auditoría y ejecuciones de agentes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────── Usuarios y sesiones ───────────────────────────

CREATE TYPE user_role AS ENUM ('owner', 'operator', 'viewer');

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text NOT NULL,
  password_hash   text NOT NULL,
  role            user_role NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  failed_logins   integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

-- El token de sesión nunca se guarda en claro: solo su hash SHA-256.
CREATE TABLE sessions (
  token_hash      text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  ip              text,
  user_agent      text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ─────────────────────────── Prospectos ───────────────────────────

CREATE TYPE pipeline_status AS ENUM (
  'DISCOVERED','RESEARCHING','QUALIFIED','REJECTED','AUDITED',
  'DEMO_GENERATING','DEMO_READY','OUTREACH_READY','SENT_MANUALLY','WAITING_RESPONSE',
  'REPLIED_POSITIVE','REPLIED_NEGATIVE','FOLLOW_UP_REQUIRED','DISCOVERY_REQUIRED','PROPOSAL_SENT',
  'NEGOTIATION','APPROVED','BUILDING','STAGING','CLIENT_REVIEW',
  'QA','READY_TO_DEPLOY','DEPLOYED','MAINTENANCE','CLOSED'
);

CREATE TYPE actor_type AS ENUM ('user', 'agent', 'system');

CREATE TABLE prospects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  legal_name            text,
  country               char(2) NOT NULL,           -- ISO 3166-1 alfa-2
  region                text,
  city                  text,
  language              text,                       -- BCP 47, ej. es-AR
  industry              text,
  website_url           text,
  website_domain        text,                       -- normalizado para deduplicar
  status                pipeline_status NOT NULL DEFAULT 'DISCOVERED',
  paused                boolean NOT NULL DEFAULT false,
  opportunity_score     smallint CHECK (opportunity_score BETWEEN 0 AND 100),
  site_score            smallint CHECK (site_score BETWEEN 0 AND 100),
  score_explanation     jsonb,
  main_issues           text[] NOT NULL DEFAULT '{}',
  recommended_solution  text,
  currency              char(3),
  estimated_value       numeric(14,2) CHECK (estimated_value >= 0),
  confirmed_value       numeric(14,2) CHECK (confirmed_value >= 0),
  -- true = dato de ejemplo cargado para probar el panel. El panel lo marca siempre.
  is_sample             boolean NOT NULL DEFAULT false,
  owner_user_id         uuid REFERENCES users(id),
  created_by_type       actor_type NOT NULL,
  created_by_id         text,
  discovered_at         timestamptz NOT NULL DEFAULT now(),
  last_verified_at      timestamptz,
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
-- Un dominio no puede estar dos veces entre prospectos vivos.
CREATE UNIQUE INDEX prospects_domain_uq ON prospects (website_domain)
  WHERE website_domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX prospects_status_idx ON prospects (status) WHERE deleted_at IS NULL;
CREATE INDEX prospects_country_idx ON prospects (country) WHERE deleted_at IS NULL;

-- ─────────────────────────── Hechos con fuente ───────────────────────────
-- Cada dato de una empresa (contacto, rubro, colores, redes...) se guarda como hecho,
-- con su fuente, URL, fecha de verificación, confianza y estado.

CREATE TYPE fact_kind AS ENUM ('observed', 'inference', 'hypothesis');
CREATE TYPE fact_verification AS ENUM ('verified', 'probable', 'unconfirmed');
CREATE TYPE fact_category AS ENUM ('identity', 'contact', 'business', 'visual', 'tech', 'reputation', 'other');

CREATE TABLE prospect_facts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  category        fact_category NOT NULL,
  field           text NOT NULL,
  value           text NOT NULL,
  kind            fact_kind NOT NULL,
  verification    fact_verification NOT NULL,
  confidence      smallint NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  source_name     text,
  source_url      text,
  verified_at     timestamptz,
  collected_by_type actor_type NOT NULL,
  collected_by_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  -- Un hecho "verificado" siempre tiene URL de fuente y fecha de verificación.
  CONSTRAINT verified_needs_source CHECK (
    verification <> 'verified' OR (source_url IS NOT NULL AND verified_at IS NOT NULL)
  ),
  -- Un hecho observado siempre dice de dónde salió.
  CONSTRAINT observed_needs_source CHECK (
    kind <> 'observed' OR source_url IS NOT NULL
  ),
  -- Una inferencia o hipótesis nunca puede figurar como verificada.
  CONSTRAINT inference_not_verified CHECK (
    kind = 'observed' OR verification <> 'verified'
  )
);
CREATE INDEX prospect_facts_prospect_idx ON prospect_facts (prospect_id) WHERE deleted_at IS NULL;

-- ─────────────────────────── Historial del pipeline ───────────────────────────

CREATE TABLE pipeline_events (
  id              bigserial PRIMARY KEY,
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  from_status     pipeline_status,
  to_status       pipeline_status NOT NULL,
  actor_type      actor_type NOT NULL,
  actor_id        text,
  actor_label     text NOT NULL,
  reason          text NOT NULL CHECK (length(trim(reason)) > 0),
  action          text NOT NULL,
  result          text,
  next_step       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pipeline_events_prospect_idx ON pipeline_events (prospect_id, created_at);
CREATE INDEX pipeline_events_to_idx ON pipeline_events (to_status, created_at);

-- ─────────────────────────── Aprobaciones humanas ───────────────────────────

CREATE TYPE approval_action AS ENUM (
  'send_email','send_whatsapp','submit_contact_form','publish_social',
  'buy_domain','contract_hosting','make_payment','deploy_production','change_dns',
  'modify_client_site','access_client_data','delete_files','modify_production_db',
  'contact_company','start_project','delete_production_data'
);
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired', 'executed');

CREATE TABLE approvals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id         uuid REFERENCES prospects(id) ON DELETE SET NULL,
  action              approval_action NOT NULL,
  summary             text NOT NULL,
  payload             jsonb NOT NULL DEFAULT '{}',
  status              approval_status NOT NULL DEFAULT 'pending',
  required_approvals  smallint NOT NULL DEFAULT 1 CHECK (required_approvals IN (1, 2)),
  requested_by_type   actor_type NOT NULL,
  requested_by_id     text,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  decided_at          timestamptz,
  executed_at         timestamptz
);
CREATE INDEX approvals_status_idx ON approvals (status, requested_at);

CREATE TABLE approval_decisions (
  approval_id   uuid NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id),
  decision      text NOT NULL CHECK (decision IN ('approve', 'reject')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (approval_id, user_id)   -- una persona no puede aprobar dos veces lo mismo
);

-- ─────────────────────────── Notas ───────────────────────────

CREATE TABLE notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES users(id),
  body          text NOT NULL CHECK (length(trim(body)) > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX notes_prospect_idx ON notes (prospect_id, created_at) WHERE deleted_at IS NULL;

-- ─────────────────────────── Configuración ───────────────────────────
-- Una sola fila vigente; cada cambio queda en settings_history.

CREATE TABLE settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data          jsonb NOT NULL,
  version       integer NOT NULL DEFAULT 1,
  updated_by    uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings_history (
  id            bigserial PRIMARY KEY,
  version       integer NOT NULL,
  data          jsonb NOT NULL,
  changed_by    uuid REFERENCES users(id),
  changed_at    timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────── Auditoría ───────────────────────────

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  actor_type    actor_type NOT NULL,
  actor_id      text,
  action        text NOT NULL,
  entity_type   text,
  entity_id     text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action, created_at DESC);

-- ─────────────────────────── Ejecuciones de agentes ───────────────────────────

CREATE TYPE run_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'blocked');

CREATE TABLE agent_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         text NOT NULL,
  task          text NOT NULL,
  prospect_id   uuid REFERENCES prospects(id) ON DELETE SET NULL,
  status        run_status NOT NULL DEFAULT 'queued',
  attempt       smallint NOT NULL DEFAULT 1,
  max_attempts  smallint NOT NULL DEFAULT 3,
  run_after     timestamptz NOT NULL DEFAULT now(),
  model         text,
  tool          text,
  input         jsonb NOT NULL DEFAULT '{}',
  output        jsonb,
  cost_usd      numeric(10,4) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  tokens_in     integer,
  tokens_out    integer,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
CREATE INDEX agent_runs_queue_idx ON agent_runs (status, run_after);
CREATE INDEX agent_runs_created_idx ON agent_runs (created_at);

-- ─────────────────────────── Registros inmutables ───────────────────────────
-- El historial del pipeline, la auditoría, las decisiones de aprobación y el
-- historial de configuración no se pueden editar ni borrar.

CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo agregado: no se permite %', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER pipeline_events_append_only BEFORE UPDATE OR DELETE ON pipeline_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER approval_decisions_append_only BEFORE UPDATE OR DELETE ON approval_decisions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER settings_history_append_only BEFORE UPDATE OR DELETE ON settings_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
