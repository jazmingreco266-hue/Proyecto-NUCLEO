"use client";

import { useRef, useState } from "react";

/** Texto listo para copiar y pegar en el canal correspondiente. */
export function CopyBlock({ label, text, rows = 6 }: { label: string; text: string; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<"" | "ok" | "manual">("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      ref.current?.select();
      setCopied("manual");
    }
    setTimeout(() => setCopied(""), 2500);
  }
  return (
    <div className="copy-block">
      <div className="copy-head">
        <span className="copy-label">{label}</span>
        <button type="button" className="btn btn-small" onClick={copy}>
          {copied === "ok" ? "Copiado" : "Copiar"}
        </button>
      </div>
      <textarea ref={ref} readOnly value={text} rows={rows} aria-label={label} />
      {copied === "manual" && <p className="faint">Seleccioné el texto: copialo con Ctrl+C o manteniendo apretado.</p>}
    </div>
  );
}
