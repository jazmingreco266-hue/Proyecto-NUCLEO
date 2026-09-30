"use client";

import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Detecta cuando se publicó una versión nueva del panel mientras estaba abierto.
 * Si volvés a la app y no estabas escribiendo nada, recarga sola; si hay algo escrito sin guardar,
 * solo avisa, para no perderlo.
 */
export function UpdateNotice() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const current = process.env.NUCLEO_VERSION;
    if (!current) return;
    let typing = false;
    const onInput = () => (typing = true);
    const onSubmit = () => (typing = false);

    async function check(canReload: boolean) {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!version || version === current) return;
        if (canReload && !typing) window.location.reload();
        else setAvailable(true);
      } catch {
        // Sin conexión: se vuelve a intentar en el próximo chequeo.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };

    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void check(false), CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="notice notice-signal update-notice" role="status">
      <span>Hay una versión nueva del panel.</span>
      <button className="btn btn-small" onClick={() => window.location.reload()}>
        Actualizar
      </button>
    </div>
  );
}
