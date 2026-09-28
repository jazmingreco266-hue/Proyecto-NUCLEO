import { STATUS_GROUP, STATUS_LABELS, type PipelineStatus } from "@/domain/pipeline";
import { countryName } from "@/domain/validation";

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const dayFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

export function When({ date, withTime = true }: { date: Date | null | undefined; withTime?: boolean }) {
  if (!date) return <span className="faint">—</span>;
  return (
    <time dateTime={date.toISOString()} className="nowrap">
      {(withTime ? dateFmt : dayFmt).format(date)}
    </time>
  );
}

export function Status({ status }: { status: PipelineStatus }) {
  return <span className={`status g-${STATUS_GROUP[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Score({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="score-none">Sin puntaje</span>;
  return (
    <span className="score">
      <meter min={0} max={100} low={40} high={70} optimum={100} value={value} aria-label={label} />
      <span className="num">{value}</span>
    </span>
  );
}

export function Country({ code }: { code: string }) {
  return <span title={code}>{countryName(code)}</span>;
}

export function formatMoney(amount: number, currency: string | null) {
  if (!currency) return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount) + " (sin moneda)";
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Enlace externo seguro: nunca abre esquemas que no sean http/https. */
export function ExternalLink({ href, children }: { href: string | null; children?: React.ReactNode }) {
  if (!href) return <span className="faint">—</span>;
  let safe = false;
  try {
    const u = new URL(href);
    safe = u.protocol === "https:" || u.protocol === "http:";
  } catch {}
  if (!safe) return <span className="faint">Enlace inválido</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children ?? href}
    </a>
  );
}
