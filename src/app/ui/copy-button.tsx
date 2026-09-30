"use client";

import { useState } from "react";

/** Copia un texto al portapapeles. No envía nada: el envío lo hace una persona. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState<"ok" | "error" | null>(null);
  return (
    <button
      type="button"
      className="btn btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone("ok");
        } catch {
          setDone("error");
        }
        setTimeout(() => setDone(null), 2500);
      }}
    >
      <span aria-live="polite">{done === "ok" ? "Copiado" : done === "error" ? "No se pudo copiar" : label}</span>
    </button>
  );
}
