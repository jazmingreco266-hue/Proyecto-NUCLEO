const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie|session|credential|private/i;

/**
 * Limpia metadatos antes de guardarlos en logs: nunca deben quedar
 * contraseñas, tokens ni claves, aunque alguien los pase por error.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundidad máxima]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[oculto]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}…`;
  return value;
}
