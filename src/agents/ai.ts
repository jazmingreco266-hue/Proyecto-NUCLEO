/**
 * Llamada a Claude para la investigación. Aislada detrás de una interfaz chica
 * para poder reemplazarla en los tests sin gastar.
 */
import Anthropic from "@anthropic-ai/sdk";
import { RESEARCH_JSON_SCHEMA, RESEARCH_MAX_TOKENS, RESEARCH_MODEL, RESEARCH_SYSTEM, type Usage } from "@/domain/research";

export type ResearchCall = { prompt: string };

export type ResearchResponse =
  | { kind: "ok"; text: string; usage: Usage; model: string }
  | { kind: "refused"; category: string | null; usage: Usage; model: string }
  | { kind: "truncated"; usage: Usage; model: string };

export type ResearchModel = (call: ResearchCall) => Promise<ResearchResponse>;

/** Pedido genérico con salida JSON según un esquema. */
export type JsonCall = { system: string; schema: object; maxTokens: number; prompt: string };
export type JsonModel = (call: JsonCall) => Promise<ResearchResponse>;

/** Hay credenciales para la API de Anthropic en el entorno del servidor. */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

let client: Anthropic | undefined;

/**
 * Implementación real. Usa:
 * - salida estructurada con esquema JSON (el servidor igual la valida con Zod);
 * - `fallbacks: "default"`: si un clasificador de seguridad rechaza el pedido, la API lo
 *   reintenta en el modelo recomendado por Anthropic dentro de la misma llamada.
 */
export const claudeJson: JsonModel = async ({ system, schema, maxTokens, prompt }) => {
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  const res = await client.beta.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: schema as Record<string, unknown> },
    },
    messages: [{ role: "user", content: prompt }],
  });
  const usage: Usage = {
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cache_read_input_tokens: res.usage.cache_read_input_tokens,
    cache_creation_input_tokens: res.usage.cache_creation_input_tokens,
  };
  if (res.stop_reason === "refusal") {
    return { kind: "refused", category: res.stop_details?.category ?? null, usage, model: res.model };
  }
  if (res.stop_reason === "max_tokens") return { kind: "truncated", usage, model: res.model };
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { kind: "ok", text, usage, model: res.model };
};

export const claudeResearch: ResearchModel = ({ prompt }) =>
  claudeJson({ system: RESEARCH_SYSTEM, schema: RESEARCH_JSON_SCHEMA, maxTokens: RESEARCH_MAX_TOKENS, prompt });

/** Errores de la API que conviene reintentar más tarde (límite de uso, caída, red). */
export function isRetryableAiError(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError
  );
}
