import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { getSettings, settingsHistoryList } from "@/server/services/settings";
import { When } from "../../ui/format";
import { SettingsForm } from "../forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await requireUser("settings.read");
  const db = getDb();
  const [{ data, version, updatedAt }, history] = await Promise.all([
    getSettings(db, me),
    settingsHistoryList(db, me),
  ]);
  const canWrite = can(me, "settings.write");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p>
            Límites para los agentes automáticos y datos para firmar los mensajes. Los valores de partida son
            conservadores: autonomía manual y presupuesto en cero.
          </p>
        </div>
      </div>
      {!canWrite && <p className="notice">Solo el propietario puede cambiar la configuración.</p>}
      {sp.guardado && (
        <p className="notice notice-ok" role="status">
          Configuración guardada. El cambio quedó en el historial.
        </p>
      )}
      <div className="detail-grid">
        <div className="panel">
          <SettingsForm key={version} data={data} version={version} readOnly={!canWrite} />
        </div>
        <aside className="side">
          {can(me, "users.manage") && (
            <section className="panel stack">
              <h2>Copia de seguridad</h2>
              <p className="faint">
                Descarga todos los datos del panel en un archivo. No incluye contraseñas. Guardalo en un lugar privado.
              </p>
              <a className="btn" href="/api/exportar">
                Descargar copia
              </a>
            </section>
          )}
          <section className="panel stack">
            <h2>Historial</h2>
            {version === 0 ? (
              <p className="faint">Se usan los valores por defecto. Todavía no se guardó ningún cambio.</p>
            ) : (
              <>
                <p className="faint">
                  Versión {version} · <When date={updatedAt} />
                </p>
                <ul className="issues">
                  {history.map((h) => (
                    <li key={h.id}>
                      Versión {h.version}: {h.by ?? "—"} · <When date={h.changedAt} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
