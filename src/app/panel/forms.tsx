"use client";

import { ROLE_LABELS, ROLES } from "@/domain/permissions";
import { AUTONOMY_LABELS, AUTONOMY_LEVELS, CHANNELS, type Settings } from "@/domain/validation";
import { ActionForm } from "../ui/action-form";
import { createUserAction, decideApprovalAction, saveSettingsAction, toggleUserAction } from "./actions";

// ─────────────────────────── Aprobaciones ───────────────────────────

export function DecideForm({ approvalId, actionLabel }: { approvalId: string; actionLabel: string }) {
  return (
    <div className="form-grid">
      <ActionForm
        action={decideApprovalAction}
        submitLabel="Aprobar"
        confirm={() => ({
          title: `Aprobar: ${actionLabel}`,
          body: "Queda registrado con tu nombre, fecha y hora. Revisá el detalle antes de confirmar.",
          confirmLabel: "Aprobar",
        })}
      >
        {() => (
          <>
            <input type="hidden" name="approvalId" value={approvalId} />
            <input type="hidden" name="decision" value="approve" />
            <label className="field">
              <span>Nota (opcional)</span>
              <input name="note" maxLength={500} />
            </label>
          </>
        )}
      </ActionForm>
      <ActionForm action={decideApprovalAction} submitLabel="Rechazar" submitClass="btn btn-danger">
        {() => (
          <>
            <input type="hidden" name="approvalId" value={approvalId} />
            <input type="hidden" name="decision" value="reject" />
            <label className="field">
              <span>Motivo del rechazo *</span>
              <input name="note" required maxLength={500} />
            </label>
          </>
        )}
      </ActionForm>
    </div>
  );
}

// ─────────────────────────── Configuración ───────────────────────────

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  form: "Formulario web",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export function SettingsForm({ data, version, readOnly }: { data: Settings; version: number; readOnly: boolean }) {
  const lines = (a: string[]) => a.join("\n");
  return (
    <ActionForm action={saveSettingsAction} submitLabel="Guardar configuración" className="stack" hideSubmit={readOnly}>
      {() => (
        <fieldset disabled={readOnly} className="stack">
          <input type="hidden" name="version" value={version} />
          <fieldset>
            <legend>Autonomía y presupuesto</legend>
            <label className="field">
              <span>Nivel de autonomía</span>
              <select name="autonomy" defaultValue={data.autonomy}>
                {AUTONOMY_LEVELS.map((a) => (
                  <option key={a} value={a}>
                    {AUTONOMY_LABELS[a]}
                  </option>
                ))}
              </select>
              <small>En cualquier nivel, enviar, pagar, publicar o borrar siempre requiere tu aprobación.</small>
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Presupuesto mensual de APIs (USD)</span>
                <input name="apiBudgetUsdMonthly" type="number" min={0} step="0.01" defaultValue={data.apiBudgetUsdMonthly} />
                <small>Con 0, ningún agente gasta.</small>
              </label>
              <label className="field">
                <span>Máximo de leads por día</span>
                <input name="maxLeadsPerDay" type="number" min={0} max={500} defaultValue={data.maxLeadsPerDay} />
              </label>
              <label className="field">
                <span>Máximo de demos por día</span>
                <input name="maxDemosPerDay" type="number" min={0} max={50} defaultValue={data.maxDemosPerDay} />
              </label>
              <label className="field">
                <span>Puntaje mínimo de oportunidad</span>
                <input name="minOpportunityScore" type="number" min={0} max={100} defaultValue={data.minOpportunityScore} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Dónde buscar</legend>
            <div className="form-grid">
              <label className="field">
                <span>Países (códigos, uno por línea)</span>
                <textarea name="countries" rows={3} defaultValue={lines(data.countries)} />
              </label>
              <label className="field">
                <span>Ciudades</span>
                <textarea name="cities" rows={3} defaultValue={lines(data.cities)} />
                <small>Vacío = todas.</small>
              </label>
              <label className="field">
                <span>Rubros objetivo</span>
                <textarea name="industries" rows={6} defaultValue={lines(data.industries)} />
                <small>Uno por línea. Vacío = todos.</small>
              </label>
              <label className="field">
                <span>Idiomas</span>
                <textarea name="languages" rows={3} defaultValue={lines(data.languages)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Horario de ejecución</legend>
            <div className="form-grid">
              <label className="field">
                <span>Zona horaria</span>
                <input name="timezone" defaultValue={data.schedule.timezone} />
              </label>
              <label className="field">
                <span>Desde (hora)</span>
                <input name="startHour" type="number" min={0} max={23} defaultValue={data.schedule.startHour} />
              </label>
              <label className="field">
                <span>Hasta (hora)</span>
                <input name="endHour" type="number" min={1} max={24} defaultValue={data.schedule.endHour} />
              </label>
            </div>
            <div className="form-actions" role="group" aria-label="Días">
              {DAYS.map((d, i) => (
                <label key={d} className="check">
                  <input type="checkbox" name="weekdays" value={i} defaultChecked={data.schedule.weekdays.includes(i)} />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Fuentes y canales</legend>
            <div className="form-grid">
              <label className="field">
                <span>Fuentes permitidas</span>
                <textarea name="allowedSources" rows={3} defaultValue={lines(data.allowedSources)} />
                <small>Dominios o nombres de fuentes, uno por línea.</small>
              </label>
              <label className="field">
                <span>Fuentes bloqueadas</span>
                <textarea name="blockedSources" rows={3} defaultValue={lines(data.blockedSources)} />
              </label>
            </div>
            <div className="form-actions" role="group" aria-label="Canales comerciales">
              {CHANNELS.map((c) => (
                <label key={c} className="check">
                  <input type="checkbox" name="channels" value={c} defaultChecked={data.channels.includes(c)} />
                  {CHANNEL_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Perfil de cliente ideal</legend>
            <p className="faint">
              Apuntá a empresas con presupuesto para un proyecto serio. Los valores iniciales son una sugerencia: ajustalos a tu estrategia.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Empleados mínimos (estimado)</span>
                <input name="minEmployees" type="number" min={0} defaultValue={data.targeting.minEmployees} />
              </label>
              <label className="field">
                <span>Valor mínimo del proyecto (USD)</span>
                <input name="minProjectValueUsd" type="number" min={0} step="100" defaultValue={data.targeting.minProjectValueUsd} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="requireOwnWebsite" defaultChecked={data.targeting.requireOwnWebsite} />
              Solo empresas que ya tienen sitio web propio
            </label>
          </fieldset>

          <fieldset>
            <legend>Firma de los mensajes</legend>
            <p className="faint">Aparece al final de cada mensaje preparado. Hace falta nombre y email para generar mensajes.</p>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input name="senderName" maxLength={120} defaultValue={data.sender.name} autoComplete="name" />
              </label>
              <label className="field">
                <span>Cargo</span>
                <input name="senderRole" maxLength={120} defaultValue={data.sender.role} placeholder="Ej.: Directora" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="senderEmail" type="email" maxLength={254} defaultValue={data.sender.email} autoComplete="email" />
              </label>
              <label className="field">
                <span>Teléfono o WhatsApp</span>
                <input name="senderPhone" maxLength={40} defaultValue={data.sender.phone} autoComplete="tel" />
              </label>
              <label className="field">
                <span>Sitio web</span>
                <input name="senderWebsite" type="url" maxLength={2000} defaultValue={data.sender.website} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Criterios de descarte</legend>
            <label className="check">
              <input type="checkbox" name="requirePublicContact" defaultChecked={data.discard.requirePublicContact} />
              Descartar empresas sin un contacto comercial público
            </label>
            <div className="form-grid">
              <label className="field">
                <span>No contactar si el sitio ya puntúa más de</span>
                <input name="skipIfSiteScoreAbove" type="number" min={0} max={100} defaultValue={data.discard.skipIfSiteScoreAbove} />
              </label>
              <label className="field">
                <span>Rubros excluidos</span>
                <textarea name="excludedIndustries" rows={2} defaultValue={lines(data.discard.excludedIndustries)} />
              </label>
            </div>
          </fieldset>
        </fieldset>
      )}
    </ActionForm>
  );
}

// ─────────────────────────── Usuarios ───────────────────────────

export function NewUserForm() {
  return (
    <ActionForm action={createUserAction} submitLabel="Crear usuario">
      {(v) => (
        <div className="form-grid">
          <label className="field">
            <span>Nombre</span>
            <input name="name" required defaultValue={v.name} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" required defaultValue={v.email} autoComplete="off" />
          </label>
          <label className="field">
            <span>Rol</span>
            <select name="role" defaultValue={v.role ?? "operator"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Contraseña inicial</span>
            <input name="password" type="password" required minLength={12} autoComplete="new-password" />
            <small>Mínimo 12 caracteres, con letras y números.</small>
          </label>
        </div>
      )}
    </ActionForm>
  );
}

export function ToggleUserForm({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  return (
    <ActionForm
      action={toggleUserAction}
      submitLabel={active ? "Desactivar" : "Reactivar"}
      submitClass={active ? "btn btn-danger btn-small" : "btn btn-small"}
      confirm={
        active
          ? () => ({
              title: `Desactivar a ${name}`,
              body: "Se cierran todas sus sesiones y no puede volver a entrar hasta que la reactives.",
              confirmLabel: "Desactivar",
            })
          : undefined
      }
    >
      {() => (
        <>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={active ? "false" : "true"} />
        </>
      )}
    </ActionForm>
  );
}
