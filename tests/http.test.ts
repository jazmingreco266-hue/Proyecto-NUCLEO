import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAllowed, parseRobots, crawlDelaySeconds } from "@/domain/robots";
import { decode, isPublicAddress, nodeTransport, PoliteFetcher, type RawResponse, type Transport } from "@/agents/http";

describe("robots.txt (RFC 9309)", () => {
  const txt = `
# comentario
User-agent: *
Disallow: /privado/
Allow: /privado/publico.html
Disallow: /*.pdf$
Crawl-delay: 4

User-agent: NucleoBot
User-agent: otro
Disallow: /solo-nucleo/

Sitemap: https://ejemplo.com/sitemap.xml
`;
  const r = parseRobots(txt);

  it("elige el grupo específico del agente y no mezcla el de '*'", () => {
    expect(isAllowed(r, "NucleoBot", "/privado/x")).toBe(true);
    expect(isAllowed(r, "NucleoBot", "/solo-nucleo/a")).toBe(false);
    expect(isAllowed(r, "OtroBot", "/privado/x")).toBe(false);
  });

  it("gana la regla más larga; Allow gana ante empate", () => {
    expect(isAllowed(r, "Cualquiera", "/privado/publico.html")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a"), "x", "/a")).toBe(true);
  });

  it("soporta * y $", () => {
    expect(isAllowed(r, "Cualquiera", "/docs/manual.pdf")).toBe(false);
    expect(isAllowed(r, "Cualquiera", "/docs/manual.pdf?v=2")).toBe(true);
  });

  it("Disallow vacío no prohíbe; robots.txt siempre se puede leer", () => {
    const open = parseRobots("User-agent: *\nDisallow:");
    expect(isAllowed(open, "x", "/lo-que-sea")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /"), "x", "/robots.txt")).toBe(true);
  });

  it("lee sitemaps y crawl-delay", () => {
    expect(r.sitemaps).toEqual(["https://ejemplo.com/sitemap.xml"]);
    expect(crawlDelaySeconds(r, "Cualquiera")).toBe(4);
    expect(crawlDelaySeconds(r, "NucleoBot")).toBeNull();
  });
});

describe("direcciones públicas", () => {
  it("rechaza IPs privadas, loopback, link-local y mapeadas", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.1.1", "169.254.169.254", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1", "0.0.0.0"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicAddress("no-es-ip")).toBe(false);
  });
});

/** Transporte simulado: un mapa de URL → respuesta. */
function fake(routes: Record<string, Partial<RawResponse> & { text?: string }>, log: string[] = []): Transport {
  return async (url, req) => {
    log.push(`${req.method} ${url.href}`);
    const r = routes[url.href];
    if (!r) return { status: 404, headers: {}, body: Buffer.from(""), truncated: false, ms: 1 };
    const body = Buffer.from(r.text ?? "");
    const cut = body.length > req.maxBytes;
    return { status: r.status ?? 200, headers: r.headers ?? {}, body: cut ? body.subarray(0, req.maxBytes) : body, truncated: cut, ms: 5 };
  };
}

const noWait = { minIntervalMs: 0, sleep: async () => {} };

describe("lector respetuoso", () => {
  it("respeta robots.txt y no pide la página prohibida", async () => {
    const log: string[] = [];
    const f = new PoliteFetcher({
      ...noWait,
      transport: fake({ "https://a.test/robots.txt": { text: "User-agent: *\nDisallow: /" } }, log),
    });
    const r = await f.get("https://a.test/");
    expect(r).toMatchObject({ ok: false, reason: "robots" });
    expect(log).toEqual(["GET https://a.test/robots.txt"]);
  });

  it("vuelve a validar robots.txt en cada redirección", async () => {
    const log: string[] = [];
    const f = new PoliteFetcher({
      ...noWait,
      transport: fake(
        {
          "https://a.test/": { status: 301, headers: { location: "https://b.test/inicio" } },
          "https://b.test/robots.txt": { text: "User-agent: NucleoBot\nDisallow: /inicio" },
        },
        log,
      ),
    });
    const r = await f.get("https://a.test/");
    expect(r).toMatchObject({ ok: false, reason: "robots", url: "https://b.test/inicio" });
    expect(log).not.toContain("GET https://b.test/inicio");
  });

  it("sigue redirecciones permitidas y las registra", async () => {
    const f = new PoliteFetcher({
      ...noWait,
      transport: fake({
        "http://a.test/": { status: 301, headers: { location: "https://a.test/" } },
        "https://a.test/": { text: "<html>hola</html>", headers: { "content-type": "text/html" } },
      }),
    });
    const r = await f.get("http://a.test/");
    expect(r).toMatchObject({ ok: true, url: "https://a.test/", redirects: ["http://a.test/"], body: "<html>hola</html>" });
  });

  it("no evade bloqueos: 403 y 429 se informan sin reintentar", async () => {
    for (const status of [403, 429]) {
      const log: string[] = [];
      const f = new PoliteFetcher({ ...noWait, transport: fake({ "https://a.test/": { status } }, log) });
      const r = await f.get("https://a.test/");
      expect(r).toMatchObject({ ok: false, reason: "denied", status });
      expect(log.filter((l) => l.endsWith("https://a.test/"))).toHaveLength(1);
    }
  });

  it("robots.txt con 5xx o sin respuesta: no lee el sitio", async () => {
    const f = new PoliteFetcher({ ...noWait, transport: fake({ "https://a.test/robots.txt": { status: 503 } }) });
    expect(await f.get("https://a.test/")).toMatchObject({ ok: false, reason: "robots" });
    const g = new PoliteFetcher({
      ...noWait,
      transport: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(await g.get("https://a.test/")).toMatchObject({ ok: false, reason: "network" });
  });

  it("corta respuestas demasiado grandes", async () => {
    const f = new PoliteFetcher({
      ...noWait,
      maxBytes: 10,
      transport: fake({ "https://a.test/": { text: "x".repeat(100) } }),
    });
    const r = await f.get("https://a.test/");
    expect(r).toMatchObject({ ok: true, truncated: true, bytes: 10 });
  });

  it("espera entre pedidos al mismo dominio y respeta Crawl-delay con tope", async () => {
    let clock = 0;
    const waits: number[] = [];
    const f = new PoliteFetcher({
      minIntervalMs: 1000,
      maxCrawlDelayMs: 5000,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
      transport: fake({
        "https://a.test/robots.txt": { text: "User-agent: *\nCrawl-delay: 60" },
        "https://a.test/1": { text: "1" },
        "https://a.test/2": { text: "2" },
      }),
    });
    await f.get("https://a.test/1");
    await f.get("https://a.test/2");
    // robots.txt → /1 (1 s mínimo) → /2 (Crawl-delay 60 s, con tope en 5 s)
    expect(waits).toEqual([1000, 5000]);
  });

  it("rechaza esquemas que no son http/https y credenciales en la URL", async () => {
    const f = new PoliteFetcher({ ...noWait, transport: fake({}) });
    expect(await f.get("file:///etc/passwd")).toMatchObject({ ok: false, reason: "invalid_url" });
    expect(await f.get("https://user:pass@a.test/")).toMatchObject({ ok: false, reason: "invalid_url" });
  });

  it("decodifica latin-1 según el encabezado", () => {
    expect(decode(Buffer.from([0x61, 0xf1, 0x6f]), "text/html; charset=iso-8859-1")).toBe("año");
  });
});

describe("transporte real", () => {
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/robots.txt") return res.writeHead(404).end();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<p>ua=${req.headers["user-agent"]}</p>`);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("por defecto se niega a conectarse a la red local (SSRF)", async () => {
    const f = new PoliteFetcher({ ...noWait });
    const r = await f.get(`${base}/`);
    expect(r).toMatchObject({ ok: false, reason: "network" });
  });

  it("también bloquea un nombre que resuelve a la red local", async () => {
    const t = nodeTransport();
    const port = (server.address() as AddressInfo).port;
    await expect(
      t(new URL(`http://localhost:${port}/`), { method: "GET", headers: {}, timeoutMs: 2000, maxBytes: 1000 }),
    ).rejects.toThrow(/no pública/);
  });

  it("con la red local habilitada (solo tests) lee la página y se identifica", async () => {
    const f = new PoliteFetcher({ ...noWait, transport: nodeTransport({ allowPrivateNetwork: true }) });
    const r = await f.get(`${base}/`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toContain("NucleoBot/");
  });
});
