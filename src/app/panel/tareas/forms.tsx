"use client";

import { ActionForm } from "../../ui/action-form";
import { cancelRunAction, retryRunAction } from "./actions";

export function RunActions({ runId, canRetry, canCancel }: { runId: string; canRetry: boolean; canCancel: boolean }) {
  return (
    <div className="row-actions">
      {canRetry && (
        <ActionForm action={retryRunAction} submitLabel="Reintentar" submitClass="btn btn-small" pendingLabel="Encolando…" className="inline-form">
          {() => <input type="hidden" name="runId" value={runId} />}
        </ActionForm>
      )}
      {canCancel && (
        <ActionForm
          action={cancelRunAction}
          submitLabel="Cancelar"
          submitClass="btn btn-danger btn-small"
          pendingLabel="Cancelando…"
          className="inline-form"
          confirm={() => ({ title: "Cancelar tarea", body: "La tarea no se va a ejecutar. Queda en el registro.", confirmLabel: "Cancelar tarea" })}
        >
          {() => <input type="hidden" name="runId" value={runId} />}
        </ActionForm>
      )}
    </div>
  );
}
