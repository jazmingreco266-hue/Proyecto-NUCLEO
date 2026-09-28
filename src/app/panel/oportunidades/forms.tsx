"use client";

import { STATUS_LABELS, type PipelineStatus } from "@/domain/pipeline";
import {
  FACT_CATEGORIES,
  FACT_CATEGORY_LABELS,
  FACT_KIND_LABELS,
  FACT_KINDS,
  FACT_VERIFICATION_LABELS,
  FACT_VERIFICATIONS,
} from "@/domain/validation";
import { ActionForm } from "../../ui/action-form";
import {
  addFactAction,
  addNoteAction,
  editMessagesAction,
  generateMessagesAction,
  createProspectAction,
  pauseAction,
  removeFactAction,
  transitionAction,
} from "./actions";

// ─────────────────────────── Alta ───────────────────────────

export function NewProspectForm() {
  return (
    <ActionForm action={createProspectAction} submitLabel="Guardar prospecto">
      {(v) => (
        <>
          <fieldset>
            <legend>Empresa</legend>
            <div className="form-grid">
              <label className="field">
                <span>Nombre comercial *</span>
                <input name="name" required minLength={2} maxLength={200} defaultValue={v.name} />
              </label>
              <label className="field">
                <span>Razón social</span>
                <input name="legalName" maxLength={200} defaultValue={v.legalName} />
              </label>
              <label className="field">
                <span>Rubro</span>
                <input name="industry" maxLength={120} defaultValue={v.industry} placeholder="Ej.: Gastronomía" />
              </label>
              <label className="field">
                <span>Sitio web actual</span>
                <input name="websiteUrl" type="url" inputMode="url" maxLength={2000} defaultValue={v.websiteUrl} placeholder="https://" />
                <small>Se usa para evitar duplicados. Solo dominios públicos.</small>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Ubicación e idioma</legend>
            <div className="form-grid">
              <label className="field">
                <span>País (código de 2 letras) *</span>
                <input name="country" required maxLength={2} defaultValue={v.country ?? "AR"} autoCapitalize="characters" />
              </label>
              <label className="field">
                <span>Provincia o estado</span>
                <input name="region" maxLength={120} defaultValue={v.region} />
              </label>
              <label className="field">
                <span>Ciudad</span>
                <input name="city" maxLength={120} defaultValue={v.city} />
              </label>
              <label className="field">
                <span>Idioma</span>
                <input name="language" maxLength={20} defaultValue={v.language ?? "es-AR"} />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Valor estimado (opcional)</legend>
            <div className="form-grid">
              <label className="field">
                <span>Moneda</span>
                <input name="currency" maxLength={3} defaultValue={v.currency ?? "ARS"} autoCapitalize="characters" />
              </label>
              <label className="field">
                <span>Monto estimado del proyecto</span>
                <input name="estimatedValue" type="number" min={0} step="1" defaultValue={v.estimatedValue} />
                <small>Es una estimación tuya. Se muestra como ingreso potencial, nunca como confirmado.</small>
              </label>
            </div>
          </fieldset>
          <p className="faint">
            Los datos de contacto, redes y características se agregan después, cada uno con su fuente.
          </p>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Cambio de estado ───────────────────────────

const CONFIRM: Partial<Record<PipelineStatus, { title: string; body: string; confirmLabel: string }>> = {
  APPROVED: {
    title: "Aprobar y comenzar proyecto",
    body: "Esto habilita la construcción del proyecto para esta empresa. Confirmalo solo si el cliente aceptó la propuesta.",
    confirmLabel: "Aprobar y comenzar proyecto",
  },
  DEPLOYED: {
    title: "Marcar como publicado",
    body: "Usa la aprobación de publicación en producción registrada para este prospecto.",
    confirmLabel: "Confirmar publicación",
  },
  SENT_MANUALLY: {
    title: "Marcar como enviado",
    body: "Confirmá que enviaste vos el mensaje. El sistema nunca envía mensajes por su cuenta.",
    confirmLabel: "Sí, lo envié",
  },
  REJECTED: {
    title: "Descartar prospecto",
    body: "El prospecto queda descartado. Solo el propietario puede reabrirlo.",
    confirmLabel: "Descartar",
  },
  CLOSED: {
    title: "Cerrar prospecto",
    body: "Cerrado es un estado final: no se puede reabrir.",
    confirmLabel: "Cerrar definitivamente",
  },
};

export function TransitionForm({
  prospectId,
  version,
  targets,
}: {
  prospectId: string;
  version: number;
  targets: PipelineStatus[];
}) {
  if (!targets.length) {
    return <p className="faint">Desde este estado no hay pasos disponibles para tu rol.</p>;
  }
  return (
    <ActionForm
      action={transitionAction}
      submitLabel="Cambiar estado"
      confirm={(f) => CONFIRM[f.get("to") as PipelineStatus] ?? null}
    >
      {(v) => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <input type="hidden" name="version" value={version} />
          <label className="field">
            <span>Nuevo estado</span>
            <select name="to" required defaultValue={v.to ?? targets[0]}>
              {targets.map((t) => (
                <option key={t} value={t}>
                  {t === "APPROVED" ? "Aprobar y comenzar proyecto" : STATUS_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Motivo *</span>
            <textarea name="reason" required minLength={3} maxLength={1000} defaultValue={v.reason} rows={3} />
          </label>
          <label className="field">
            <span>Próximo paso</span>
            <input name="nextStep" maxLength={500} defaultValue={v.nextStep} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Pausa ───────────────────────────

export function PauseForm({ prospectId, version, paused }: { prospectId: string; version: number; paused: boolean }) {
  return (
    <ActionForm
      action={pauseAction}
      submitLabel={paused ? "Reanudar" : "Pausar"}
      submitClass="btn"
      pendingLabel="Guardando…"
    >
      {() => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="paused" value={paused ? "false" : "true"} />
          <p className="faint">
            {paused
              ? "Está pausado: los agentes no lo mueven."
              : "Al pausarlo, los agentes dejan de trabajar sobre este prospecto."}
          </p>
          <label className="field">
            <span>Motivo *</span>
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Hechos con fuente ───────────────────────────

export function FactForm({ prospectId, defaultCategory }: { prospectId: string; defaultCategory?: string }) {
  return (
    <ActionForm action={addFactAction} submitLabel="Guardar dato">
      {(v) => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <div className="form-grid">
            <label className="field">
              <span>Categoría</span>
              <select name="category" defaultValue={v.category ?? defaultCategory ?? "business"}>
                {FACT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {FACT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Dato *</span>
              <input name="field" required minLength={2} maxLength={120} defaultValue={v.field} placeholder="Ej.: Email comercial" />
            </label>
          </div>
          <label className="field">
            <span>Valor *</span>
            <textarea name="value" required maxLength={4000} rows={2} defaultValue={v.value} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Tipo</span>
              <select name="kind" defaultValue={v.kind ?? "observed"}>
                {FACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FACT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select name="verification" defaultValue={v.verification ?? "unconfirmed"}>
                {FACT_VERIFICATIONS.map((k) => (
                  <option key={k} value={k}>
                    {FACT_VERIFICATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Confianza (0–100)</span>
              <input name="confidence" type="number" min={0} max={100} required defaultValue={v.confidence ?? "50"} />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Fuente</span>
              <input name="sourceName" maxLength={200} defaultValue={v.sourceName} placeholder="Ej.: Sitio oficial, página de contacto" />
            </label>
            <label className="field">
              <span>URL de la fuente</span>
              <input name="sourceUrl" type="url" inputMode="url" maxLength={2000} defaultValue={v.sourceUrl} placeholder="https://" />
              <small>Obligatoria para hechos observados y para marcar como verificado.</small>
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function RemoveFactForm({ factId }: { factId: string }) {
  return (
    <ActionForm
      action={removeFactAction}
      submitLabel="Retirar dato"
      submitClass="btn btn-danger btn-small"
      pendingLabel="Retirando…"
      confirm={() => ({
        title: "Retirar este dato",
        body: "Deja de mostrarse en la ficha. El retiro queda registrado en la actividad.",
        confirmLabel: "Retirar",
      })}
    >
      {() => (
        <>
          <input type="hidden" name="factId" value={factId} />
          <label className="field">
            <span>Motivo *</span>
            <input name="reason" required minLength={3} maxLength={300} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Notas ───────────────────────────

export function NoteForm({ prospectId }: { prospectId: string }) {
  return (
    <ActionForm action={addNoteAction} submitLabel="Guardar nota">
      {(v) => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <label className="field">
            <span>Nota</span>
            <textarea name="body" required maxLength={5000} rows={3} defaultValue={v.body} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Mensajes ───────────────────────────

export function GenerateMessagesForm({
  prospectId,
  defaults,
  submitLabel = "Preparar mensajes",
}: {
  prospectId: string;
  defaults: { positive?: string; opportunity?: string; benefit?: string; demoUrl?: string; contactName?: string };
  submitLabel?: string;
}) {
  return (
    <ActionForm action={generateMessagesAction} submitLabel={submitLabel} pendingLabel="Preparando…">
      {(v) => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <label className="field">
            <span>Algo positivo y concreto de la empresa *</span>
            <textarea
              name="positive"
              rows={2}
              required
              minLength={10}
              maxLength={400}
              defaultValue={v.positive ?? defaults.positive}
              placeholder="Ej.: Tienen más de 20 años de trayectoria y muy buenas reseñas por la atención."
            />
            <small>Tiene que ser verdad y salir de tu investigación. Es lo que hace que el mensaje no sea genérico.</small>
          </label>
          <label className="field">
            <span>Oportunidad concreta que viste *</span>
            <textarea
              name="opportunity"
              rows={2}
              required
              minLength={10}
              maxLength={300}
              defaultValue={v.opportunity ?? defaults.opportunity}
              placeholder="Ej.: el sitio no se adapta al celular y el formulario de turnos no confirma el envío"
            />
            <small>Describila sin criticar el trabajo actual.</small>
          </label>
          <label className="field">
            <span>Beneficio para la empresa *</span>
            <textarea
              name="benefit"
              rows={2}
              required
              minLength={10}
              maxLength={300}
              defaultValue={v.benefit ?? defaults.benefit}
              placeholder="Ej.: Resolverlo haría que más pacientes pidan turno desde el celular sin tener que llamar."
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Nombre de la persona (opcional)</span>
              <input name="contactName" maxLength={80} defaultValue={v.contactName ?? defaults.contactName} />
              <small>Solo si figura públicamente como contacto de la empresa.</small>
            </label>
            <label className="field">
              <span>Enlace a la demo (opcional)</span>
              <input name="demoUrl" type="url" maxLength={2000} defaultValue={v.demoUrl ?? defaults.demoUrl} placeholder="https://" />
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function EditMessagesForm({
  prospectId,
  version,
  current,
}: {
  prospectId: string;
  version: number;
  current: { subjects: string[]; emailText: string; whatsappText: string; formText: string; socialText: string };
}) {
  return (
    <ActionForm action={editMessagesAction} submitLabel="Guardar como versión nueva">
      {(v) => (
        <>
          <input type="hidden" name="prospectId" value={prospectId} />
          <input type="hidden" name="basedOnVersion" value={version} />
          {[1, 2, 3].map((i) => (
            <label key={i} className="field">
              <span>Asunto {i}</span>
              <input name={`subject${i}`} required maxLength={150} defaultValue={v[`subject${i}`] ?? current.subjects[i - 1] ?? ""} />
            </label>
          ))}
          <label className="field">
            <span>Email (texto)</span>
            <textarea name="emailText" rows={14} required defaultValue={v.emailText ?? current.emailText} />
            <small>Separá los párrafos con una línea en blanco. El email HTML se arma a partir de este texto.</small>
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <textarea name="whatsappText" rows={5} required defaultValue={v.whatsappText ?? current.whatsappText} />
          </label>
          <label className="field">
            <span>Formulario web</span>
            <textarea name="formText" rows={7} required defaultValue={v.formText ?? current.formText} />
          </label>
          <label className="field">
            <span>Instagram o LinkedIn</span>
            <textarea name="socialText" rows={4} required defaultValue={v.socialText ?? current.socialText} />
          </label>
        </>
      )}
    </ActionForm>
  );
}
