-- 0002 · Cola de agentes y auditorías técnicas versionadas (etapa 3, bloque A)

-- ─────────────────────────── Cola de trabajos ───────────────────────────
-- agent_runs ya existía como registro. Se le agregan los campos para funcionar como cola.

ALTER TABLE agent_runs
  ADD COLUMN requested_by_type  actor_type NOT NULL DEFAULT 'system',
  ADD COLUMN requested_by_id    text,
  ADD COLUMN dedupe_key         text,
  ADD COLUMN locked_by          text,
  ADD COLUMN locked_at          timestamptz,
  ADD COLUMN estimated_cost_usd numeric(10,4) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  ADD CONSTRAINT agent_runs_attempts_ck CHECK (attempt >= 1 AND max_attempts BETWEEN 1 AND 10);

-- El mismo trabajo no puede estar dos veces en cola o en ejecución.
CREATE UNIQUE INDEX agent_runs_dedupe_uq ON agent_runs (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');
CREATE INDEX agent_runs_prospect_idx ON agent_runs (prospect_id, created_at DESC);

-- ─────────────────────────── Auditorías de sitios ───────────────────────────
-- Cada auditoría es una versión nueva: nunca se sobrescribe una anterior.

CREATE TABLE site_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  version         integer NOT NULL CHECK (version >= 1),
  run_id          uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  requested_url   text NOT NULL,
  final_url       text NOT NULL,
  http_status     smallint NOT NULL,
  response_ms     integer NOT NULL CHECK (response_ms >= 0),
  html_bytes      integer NOT NULL CHECK (html_bytes >= 0),
  fetched_at      timestamptz NOT NULL,
  site_score      smallint CHECK (site_score BETWEEN 0 AND 100),
  categories      jsonb NOT NULL,     -- puntaje por categoría o null si no se pudo medir
  checks          jsonb NOT NULL,     -- cada verificación con su resultado y detalle
  issues          text[] NOT NULL DEFAULT '{}',
  strengths       text[] NOT NULL DEFAULT '{}',
  recommendation  jsonb NOT NULL,     -- preliminar: contactar / observar / descartar, con motivo
  tool            text NOT NULL,      -- herramienta y versión que hizo la auditoría
  created_by_type actor_type NOT NULL,
  created_by_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, version)
);
CREATE INDEX site_audits_prospect_idx ON site_audits (prospect_id, version DESC);

CREATE TRIGGER site_audits_append_only BEFORE UPDATE OR DELETE ON site_audits
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
