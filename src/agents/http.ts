/**
 * Lector respetuoso de sitios públicos.
 *
 * Reglas (sección 4.3 del documento maestro):
 * - Se identifica con un user-agent propio y lee robots.txt antes de cada sitio.
 * - Espera entre pedidos al mismo dominio (y respeta Crawl-delay, con tope).
 * - No envía cookies ni credenciales, no completa formularios, no evade logins,
 *   CAPTCHAs ni bloqueos: un 401, 403, 407, 429 o 451 se registra y no se reintenta.
 * - Solo se conecta a IPs públicas. La IP se valida al conectar, así un DNS que
 *   apunte a la red interna no sirve para llegar a servicios privados (SSRF).
 * - Lee como máximo `maxBytes` por respuesta, con tiempo límite.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { ALLOW_ALL, DISALLOW_ALL, crawlDelaySeconds, isAllowed, parseRobots, ROBOTS_MAX_BYTES, type Robots } from "@/domain/robots";

export const BOT_TOKEN = "NucleoBot";
export const BOT_VERSION = "0.3";

export function defaultUserAgent(): string {
  const contact = process.env.BOT_CONTACT_URL?.trim();
  return `Mozilla/5.0 (compatible; ${BOT_TOKEN}/${BOT_VERSION}; auditoría de sitios públicos${contact ? `; +${contact}` : ""})`;
}

// ─────────────────────────── Direcciones privadas ───────────────────────────

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net4, prefix, "ipv4");
}
for (const [net6, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net6, prefix, "ipv6");
}

export function isPublicAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicAddress(mapped[1]!);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

/** dns.lookup que rechaza direcciones privadas. Soporta la variante `all: true`. */
function safeLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "", 4);
      const list = addresses as dns.LookupAddress[];
      const bad = list.find((a) => !allowPrivate && !isPublicAddress(a.address));
      if (bad || list.length === 0) {
        const e = Object.assign(new Error(`Dirección no pública bloqueada: ${hostname}`), { code: "EPRIVATE" });
        return callback(e, "", 4);
      }
      if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

// ─────────────────────────── Transporte ───────────────────────────

export type RawResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
  ms: number;
};

export type TransportRequest = {
  method: "GET" | "HEAD";
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
};

export type Transport = (url: URL, req: TransportRequest) => Promise<RawResponse>;

export class NetworkError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Transporte real con node:http/https. `allowPrivateNetwork` existe solo para tests locales. */
export function nodeTransport(opts: { allowPrivateNetwork?: boolean } = {}): Transport {
  const lookup = safeLookup(opts.allowPrivateNetwork ?? false);
  return (url, req) =>
    new Promise<RawResponse>((resolve, reject) => {
      const started = performance.now();
      const mod = url.protocol === "https:" ? https : http;
      if (!opts.allowPrivateNetwork && net.isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
        return reject(new NetworkError("No se leen sitios por dirección IP.", "EPRIVATE"));
      }
      const r = mod.request(
        url,
        { method: req.method, headers: req.headers, lookup, timeout: req.timeoutMs, agent: false },
        (res) => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v != null) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
          }
          let stream: Readable = res;
          const enc = headers["content-encoding"]?.toLowerCase();
          if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
          else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
          else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());

          const chunks: Buffer[] = [];
          let size = 0;
          let truncated = false;
          const finish = () =>
            resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated, ms: Math.round(performance.now() - started) });
          stream.on("data", (c: Buffer) => {
            if (truncated) return;
            const room = req.maxBytes - size;
            if (c.length > room) {
              chunks.push(c.subarray(0, room));
              size += room;
              truncated = true;
              res.destroy();
              finish();
              return;
            }
            chunks.push(c);
            size += c.length;
          });
          stream.on("end", () => !truncated && finish());
          stream.on("error", (e) => !truncated && reject(new NetworkError(e.message)));
          res.on("error", (e) => !truncated && reject(new NetworkError(e.message)));
        },
      );
      r.setTimeout(req.timeoutMs, () => r.destroy(new NetworkError("Tiempo de espera agotado.", "ETIMEDOUT")));
      r.on("error", (e: Error & { code?: string }) =>
        reject(e instanceof NetworkError ? e : new NetworkError(e.message, e.code)),
      );
      r.end();
    });
}

// ─────────────────────────── Lector ───────────────────────────

export type FetchOk = {
  ok: true;
  requestedUrl: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
  ms: number;
  redirects: string[];
};

export type FetchBlockReason = "robots" | "denied" | "network" | "invalid_url" | "too_many_redirects";

export type FetchBlocked = {
  ok: false;
  reason: FetchBlockReason;
  detail: string;
  url: string;
  status?: number;
};

export type FetchResult = FetchOk | FetchBlocked;

/** Códigos que indican que el sitio no quiere ser leído: se respetan, no se reintentan. */
const DENIED = new Set([401, 403, 407, 429, 451]);

export type FetcherOptions = {
  transport?: Transport;
  userAgent?: string;
  /** Espera mínima entre pedidos al mismo host. */
  minIntervalMs?: number;
  /** Tope para Crawl-delay: más de esto, se usa el tope (y se registra). */
  maxCrawlDelayMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export class PoliteFetcher {
  readonly userAgent: string;
  private readonly transport: Transport;
  private readonly minIntervalMs: number;
  private readonly maxCrawlDelayMs: number;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly robotsCache = new Map<string, Promise<{ robots: Robots; status: number | null }>>();
  private readonly nextSlot = new Map<string, number>();
  /** Cantidad de pedidos HTTP hechos (para el registro de la ejecución). */
  requests = 0;

  constructor(o: FetcherOptions = {}) {
    this.transport = o.transport ?? nodeTransport();
    this.userAgent = o.userAgent ?? defaultUserAgent();
    this.minIntervalMs = o.minIntervalMs ?? 1500;
    this.maxCrawlDelayMs = o.maxCrawlDelayMs ?? 10_000;
    this.timeoutMs = o.timeoutMs ?? 15_000;
    this.maxBytes = o.maxBytes ?? 3 * 1024 * 1024;
    this.maxRedirects = o.maxRedirects ?? 5;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = o.now ?? Date.now;
  }

  private async wait(url: URL, robots: Robots) {
    const delay = Math.max(this.minIntervalMs, Math.min((crawlDelaySeconds(robots, BOT_TOKEN) ?? 0) * 1000, this.maxCrawlDelayMs));
    const host = url.host;
    const now = this.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + delay);
    if (slot > now) await this.sleep(slot - now);
  }

  private async raw(url: URL, method: "GET" | "HEAD", maxBytes: number): Promise<RawResponse> {
    this.requests += 1;
    return this.transport(url, {
      method,
      timeoutMs: this.timeoutMs,
      maxBytes,
      headers: {
        "user-agent": this.userAgent,
        accept: method === "HEAD" ? "*/*" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "es,en;q=0.5",
      },
    });
  }

  /** robots.txt del origen, cacheado por instancia. */
  robots(origin: string): Promise<{ robots: Robots; status: number | null }> {
    let p = this.robotsCache.get(origin);
    if (!p) {
      p = (async () => {
        const url = new URL("/robots.txt", origin);
        try {
          await this.wait(url, ALLOW_ALL);
          const res = await this.raw(url, "GET", ROBOTS_MAX_BYTES);
          // RFC 9309: 4xx = sin restricciones; 5xx o error = asumir prohibido.
          // 401/403 se tratan como prohibido: preferimos no leer ante la duda.
          if (res.status === 401 || res.status === 403) return { robots: DISALLOW_ALL, status: res.status };
          if (res.status >= 400 && res.status < 500) return { robots: ALLOW_ALL, status: res.status };
          if (res.status >= 500) return { robots: DISALLOW_ALL, status: res.status };
          if (res.status >= 300) return { robots: ALLOW_ALL, status: res.status };
          return { robots: parseRobots(decode(res.body, res.headers["content-type"])), status: res.status };
        } catch {
          return { robots: DISALLOW_ALL, status: null };
        }
      })();
      this.robotsCache.set(origin, p);
    }
    return p;
  }

  async get(input: string, opts: { method?: "GET" | "HEAD"; maxBytes?: number } = {}): Promise<FetchResult> {
    const method = opts.method ?? "GET";
    const maxBytes = Math.min(opts.maxBytes ?? this.maxBytes, this.maxBytes);
    const redirects: string[] = [];
    let current: URL;
    try {
      current = new URL(input);
    } catch {
      return { ok: false, reason: "invalid_url", detail: "URL inválida.", url: input };
    }

    for (let hop = 0; hop <= this.maxRedirects; hop++) {
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        return { ok: false, reason: "invalid_url", detail: "Solo se leen direcciones http o https.", url: current.href };
      }
      if (current.username || current.password) {
        return { ok: false, reason: "invalid_url", detail: "No se usan credenciales en URLs.", url: current.href };
      }
      current.hash = "";
      const { robots, status: robotsStatus } = await this.robots(current.origin);
      if (robotsStatus === null) {
        return { ok: false, reason: "network", detail: "No se pudo leer robots.txt: el sitio no respondió.", url: current.href };
      }
      if (!isAllowed(robots, BOT_TOKEN, current.pathname + current.search)) {
        return { ok: false, reason: "robots", detail: "robots.txt no permite leer esta dirección.", url: current.href };
      }
      await this.wait(current, robots);
      let res: RawResponse;
      try {
        res = await this.raw(current, method, maxBytes);
      } catch (e) {
        return { ok: false, reason: "network", detail: (e as Error).message, url: current.href };
      }
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        let next: URL;
        try {
          next = new URL(res.headers.location, current);
        } catch {
          return { ok: false, reason: "invalid_url", detail: "Redirección a una URL inválida.", url: current.href };
        }
        redirects.push(current.href);
        current = next;
        continue;
      }
      if (DENIED.has(res.status)) {
        return {
          ok: false,
          reason: "denied",
          status: res.status,
          detail: `El sitio respondió ${res.status}: no permite el acceso automático. No se intenta evadirlo.`,
          url: current.href,
        };
      }
      return {
        ok: true,
        requestedUrl: input,
        url: current.href,
        status: res.status,
        headers: res.headers,
        body: method === "HEAD" ? "" : decode(res.body, res.headers["content-type"]),
        bytes: res.body.length,
        truncated: res.truncated,
        ms: res.ms,
        redirects,
      };
    }
    return { ok: false, reason: "too_many_redirects", detail: "Demasiadas redirecciones.", url: current.href };
  }
}

/** Decodifica según el charset del encabezado o del <meta>; por defecto UTF-8. */
export function decode(body: Buffer, contentType?: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = body.subarray(0, 2048).toString("latin1");
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label.toLowerCase()).decode(body);
    } catch {
      // etiqueta desconocida: se prueba la siguiente
    }
  }
  return body.toString("utf8");
}
