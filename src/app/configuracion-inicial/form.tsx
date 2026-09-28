"use client";

import { ActionForm } from "../ui/action-form";
import { firstOwnerAction } from "./actions";

export function FirstOwnerForm() {
  return (
    <ActionForm action={firstOwnerAction} submitLabel="Crear mi cuenta de propietario" pendingLabel="Creando…">
      {(v) => (
        <>
          <label className="field">
            <span>Código de configuración</span>
            <input name="token" type="password" required autoComplete="off" />
            <small>Es el valor de SETUP_TOKEN que cargaste en Vercel.</small>
          </label>
          <label className="field">
            <span>Tu nombre</span>
            <input name="name" required minLength={2} defaultValue={v.name} autoComplete="name" />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" required defaultValue={v.email} autoComplete="username" />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input name="password" type="password" required minLength={12} autoComplete="new-password" />
            <small>Mínimo 12 caracteres, con letras y números.</small>
          </label>
          <label className="field">
            <span>Repetí la contraseña</span>
            <input name="password2" type="password" required minLength={12} autoComplete="new-password" />
          </label>
        </>
      )}
    </ActionForm>
  );
}
