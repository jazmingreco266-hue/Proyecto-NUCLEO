-- 0004 · Finanzas (ventas, gastos, presupuestos) y portafolio
--
-- Los movimientos de dinero no se editan ni se borran. Una vez cargados solo se puede:
--   · marcarlos como cobrados / pagados (una sola vez), o
--   · anularlos con un motivo (quedan visibles como anulados).
-- Así ningún gasto ni venta se pierde, aunque alguien se equivoque.

-- ─────────────────────────── Ventas ───────────────────────────

CREATE TABLE sales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on   date NOT NULL,
  description   text NOT NULL CHECK (length(trim(description)) > 0),
  client_name   text NOT NULL CHECK (length(trim(client_name)) > 0),
  prospect_id   uuid REFERENCES prospects(id) ON DELETE SET NULL,
  quote_id      uuid,
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status        text NOT NULL CHECK (status IN ('pendiente', 'cobrado')),
  paid_on       date,
  method        text,
  notes         text,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  voided_at     timestamptz,
  voided_by     uuid REFERENCES users(id),
  void_reason   text,
  CONSTRAINT sales_paid_has_date CHECK (status <> 'cobrado' OR paid_on IS NOT NULL),
  CONSTRAINT sales_void_complete CHECK ((voided_at IS NULL) = (void_reason IS NULL))
);
CREATE INDEX sales_date_idx ON sales (occurred_on);

-- ─────────────────────────── Gastos ───────────────────────────

CREATE TABLE expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on   date NOT NULL,
  description   text NOT NULL CHECK (length(trim(description)) > 0),
  category      text NOT NULL,
  vendor        text,
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status        text NOT NULL CHECK (status IN ('pendiente', 'pagado')),
  paid_on       date,
  notes         text,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  voided_at     timestamptz,
  voided_by     uuid REFERENCES users(id),
  void_reason   text,
  CONSTRAINT expenses_paid_has_date CHECK (status <> 'pagado' OR paid_on IS NOT NULL),
  CONSTRAINT expenses_void_complete CHECK ((voided_at IS NULL) = (void_reason IS NULL))
);
CREATE INDEX expenses_date_idx ON expenses (occurred_on);

-- Reglas de solo agregado para ventas y gastos.
CREATE FUNCTION money_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los movimientos de dinero no se borran: se anulan con un motivo';
  END IF;
  -- Los datos del movimiento nunca cambian.
  IF (NEW.id, NEW.occurred_on, NEW.description, NEW.amount, NEW.currency, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.occurred_on, OLD.description, OLD.amount, OLD.currency, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Un movimiento de dinero no se edita: anulalo y cargá uno nuevo';
  END IF;
  -- Un movimiento anulado queda cerrado.
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'El movimiento ya está anulado';
  END IF;
  -- Estado: solo de pendiente a cobrado/pagado, nunca hacia atrás.
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pendiente' THEN
    RAISE EXCEPTION 'Un movimiento cobrado o pagado no vuelve a pendiente';
  END IF;
  IF OLD.paid_on IS NOT NULL AND NEW.paid_on IS DISTINCT FROM OLD.paid_on THEN
    RAISE EXCEPTION 'La fecha de cobro o pago no se modifica';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_guard BEFORE UPDATE OR DELETE ON sales FOR EACH ROW EXECUTE FUNCTION money_guard();
CREATE TRIGGER expenses_guard BEFORE UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION money_guard();

-- ─────────────────────────── Presupuestos ───────────────────────────
-- El contenido de un presupuesto no cambia; para cambiarlo se hace uno nuevo.
-- Solo cambia su estado (borrador → enviado → aceptado / rechazado).

CREATE TABLE quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        bigserial UNIQUE,
  prospect_id   uuid REFERENCES prospects(id) ON DELETE SET NULL,
  client_name   text NOT NULL CHECK (length(trim(client_name)) > 0),
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  lines         jsonb NOT NULL,
  discount_pct  numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  tax_pct       numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_pct BETWEEN 0 AND 100),
  subtotal      numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  total         numeric(14,2) NOT NULL CHECK (total >= 0),
  valid_until   date,
  notes         text,
  status        text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviado', 'aceptado', 'rechazado')),
  sale_id       uuid REFERENCES sales(id),
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales ADD CONSTRAINT sales_quote_fk FOREIGN KEY (quote_id) REFERENCES quotes(id);

CREATE FUNCTION quotes_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los presupuestos no se borran: se marcan como rechazados';
  END IF;
  IF (NEW.id, NEW.number, NEW.prospect_id, NEW.client_name, NEW.currency, NEW.lines, NEW.discount_pct,
      NEW.tax_pct, NEW.subtotal, NEW.total, NEW.valid_until, NEW.notes, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.number, OLD.prospect_id, OLD.client_name, OLD.currency, OLD.lines, OLD.discount_pct,
      OLD.tax_pct, OLD.subtotal, OLD.total, OLD.valid_until, OLD.notes, OLD.created_by, OLD.created_at) THEN
    -- Única excepción: el prospecto se desvincula solo si se retira de la base.
    IF NOT (NEW.prospect_id IS NULL AND OLD.prospect_id IS NOT NULL) THEN
      RAISE EXCEPTION 'El contenido de un presupuesto no se edita: hacé uno nuevo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quotes_guard BEFORE UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION quotes_guard();

-- ─────────────────────────── Portafolio ───────────────────────────

CREATE TABLE portfolio_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL CHECK (length(trim(title)) > 0),
  client_name   text NOT NULL,
  prospect_id   uuid REFERENCES prospects(id) ON DELETE SET NULL,
  url           text,
  year          smallint CHECK (year BETWEEN 2000 AND 2100),
  summary       text NOT NULL DEFAULT '',
  highlights    text[] NOT NULL DEFAULT '{}',
  tags          text[] NOT NULL DEFAULT '{}',
  featured      boolean NOT NULL DEFAULT false,
  client_ok     boolean NOT NULL DEFAULT false,   -- el cliente autorizó mostrarlo
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
