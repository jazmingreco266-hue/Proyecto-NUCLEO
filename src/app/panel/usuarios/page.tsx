import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { ROLE_LABELS } from "@/domain/permissions";
import { requireUser } from "@/server/auth/current";
import { listUsers } from "@/server/services/users";
import { When } from "../../ui/format";
import { NewUserForm, ToggleUserForm } from "../forms";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireUser("users.manage");
  const users = await listUsers(getDb(), me);
  const now = new Date();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>
            Propietario: todo, incluidas las aprobaciones. Operador: trabaja prospectos, no aprueba ni configura. Solo
            lectura: mira, no cambia nada.
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="cards">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Último ingreso</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="cell-title">
                  <strong>{u.name}</strong>
                  <div className="cell-sub">{u.email}</div>
                </td>
                <td data-label="Rol">{ROLE_LABELS[u.role]}</td>
                <td data-label="Estado">
                  {!u.active ? (
                    <span className="tag">Desactivado</span>
                  ) : u.lockedUntil && u.lockedUntil > now ? (
                    <span className="tag tag-sample">Bloqueado por intentos</span>
                  ) : (
                    "Activo"
                  )}
                </td>
                <td data-label="Último ingreso">
                  <When date={u.lastLoginAt} />
                </td>
                <td data-label="Acción">
                  {u.id === me.id ? (
                    <span className="faint">Vos</span>
                  ) : (
                    <ToggleUserForm userId={u.id} active={u.active} name={u.name} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="section">
        <details className="panel disclose">
          <summary>Crear usuario</summary>
          <NewUserForm />
        </details>
      </section>
    </>
  );
}
