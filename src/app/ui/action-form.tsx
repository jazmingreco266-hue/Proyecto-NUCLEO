"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "../panel/oportunidades/actions";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: (values: Record<string, string>) => React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  submitClass?: string;
  /** Si devuelve un texto, se pide confirmación antes de enviar. */
  confirm?: (form: FormData) => { title: string; body: string; confirmLabel: string } | null;
  /** Oculta el botón (vista de solo lectura). */
  hideSubmit?: boolean;
};

/** Formulario con estado de envío, mensajes accesibles y confirmación opcional. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Guardando…",
  className = "stack",
  submitClass = "btn btn-primary",
  confirm,
  hideSubmit = false,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [ask, setAsk] = useState<{ title: string; body: string; confirmLabel: string } | null>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    if (ask) dialogRef.current?.showModal();
  }, [ask]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm || confirmed.current) {
      confirmed.current = false;
      return;
    }
    const c = confirm(new FormData(e.currentTarget));
    if (c) {
      e.preventDefault();
      setAsk(c);
    }
  }

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className}>
        {/* Tras un error, React reinicia el formulario. Los <select> no recuperan el valor
            devuelto por sí solos, así que se vuelven a montar los campos con esos valores. */}
        <Fragment key={JSON.stringify(state.values ?? {})}>{children(state.values ?? {})}</Fragment>
        {state.error && (
          <p className="notice notice-error" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="notice notice-ok" role="status">
            {state.ok}
          </p>
        )}
        {!hideSubmit && (
          <div className="form-actions">
            <button className={submitClass} disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        )}
      </form>
      {confirm && (
        <dialog ref={dialogRef} className="confirm" onClose={() => setAsk(null)} aria-labelledby="confirm-title">
          {ask && (
            <>
              <h2 id="confirm-title">{ask.title}</h2>
              <p>{ask.body}</p>
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    confirmed.current = true;
                    dialogRef.current?.close();
                    formRef.current?.requestSubmit();
                  }}
                >
                  {ask.confirmLabel}
                </button>
                <button className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </dialog>
      )}
    </>
  );
}
