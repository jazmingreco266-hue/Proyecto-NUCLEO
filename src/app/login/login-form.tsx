"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="stack" noValidate>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p className="notice notice-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
