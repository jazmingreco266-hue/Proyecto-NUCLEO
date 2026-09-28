import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { APPROVAL_LABELS } from "@/domain/approvals";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { listApprovals } from "@/server/services/approvals";
import { When } from "../../ui/format";
import { DecideForm } from "../forms";

export const metadata: Metadata = { title: "Aprobaciones" };

const STATUS_TEXT = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Vencida",
  executed: "Ejecutada",
} as const;

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser("approvals.read");
  const view = (await searchParams).ver === "resueltas" ? "resolved" : "pending";
  const rows = await listApprovals(getDb(), me, view);
  const canDecide = can(me, "approvals.decide");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Aprobaciones</h1>
          <p>
            Enviar mensajes, pagar, publicar, cambiar DNS o borrar datos nunca ocurre sin una aprobación registrada
            acá. Los agentes y operadores solo pueden pedirlas.
          </p>
        </div>
      </div>

      <nav className="tabs" aria-label="Filtro">
        <Link href="?ver=pendientes" aria-current={view === "pending" ? "page" : undefined}>
          Pendientes
        </Link>
        <Link href="?ver=resueltas" aria-current={view === "resolved" ? "page" : undefined}>
          Resueltas
        </Link>
      </nav>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>{view === "pending" ? "No hay nada esperando tu decisión" : "Todavía no hay aprobaciones resueltas"}</h3>
          <p>
            Cuando un agente prepare una acción sensible (por ejemplo, publicar un sitio), va a aparecer acá con todo
            el detalle para que la revises.
          </p>
        </div>
      ) : (
        <div className="stack">
          {rows.map(({ a, prospectName, approvalsCount, decisions }) => (
            <article key={a.id} className={`panel approval ${a.status === "pending" ? "" : "resolved"}`}>
              <div className="approval-head">
                <h2>{APPROVAL_LABELS[a.action]}</h2>
                <span className="tag">{STATUS_TEXT[a.status]}</span>
              </div>
              <p>{a.summary}</p>
              <dl className="dl">
                <dt>Prospecto</dt>
                <dd>
                  {a.prospectId && prospectName ? (
                    <Link href={`/panel/oportunidades/${a.prospectId}`}>{prospectName}</Link>
                  ) : (
                    <span className="faint">General</span>
                  )}
                </dd>
                <dt>Pedido por</dt>
                <dd>
                  {a.requestedByType === "agent" ? `Agente ${a.requestedById}` : "Persona del equipo"} ·{" "}
                  <When date={a.requestedAt} />
                </dd>
                <dt>Aprobaciones</dt>
                <dd className="num">
                  {approvalsCount} de {a.requiredApprovals}
                  {a.requiredApprovals === 2 && " (requiere dos personas distintas)"}
                </dd>
                {a.expiresAt && (
                  <>
                    <dt>Vence</dt>
                    <dd>
                      <When date={a.expiresAt} />
                    </dd>
                  </>
                )}
              </dl>
              {Object.keys(a.payload as object).length > 0 && (
                <details className="disclose">
                  <summary>Ver detalle técnico</summary>
                  <pre className="payload">{JSON.stringify(a.payload, null, 2)}</pre>
                </details>
              )}
              {decisions.length > 0 && (
                <ul className="issues">
                  {decisions.map((d) => (
                    <li key={d.userId}>
                      {d.name}: {d.decision === "approve" ? "aprobó" : "rechazó"}
                      {d.note ? ` (“${d.note}”)` : ""} · <When date={d.createdAt} />
                    </li>
                  ))}
                </ul>
              )}
              {a.status === "pending" && canDecide && !decisions.some((d) => d.userId === me.id) && (
                <DecideForm approvalId={a.id} actionLabel={APPROVAL_LABELS[a.action]} />
              )}
              {a.status === "pending" && !canDecide && (
                <p className="faint">Solo el propietario puede decidir.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
