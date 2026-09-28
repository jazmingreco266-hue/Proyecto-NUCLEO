import { describe, expect, it } from "vitest";
import { auditHtml, extractInternalLinks, recommend, type AuditInput } from "@/domain/site-audit";

const now = new Date("2026-09-28T12:00:00Z");

const OLD_SITE = `<html><head><title>Inicio</title>
<script src="/js/jquery-1.8.3.min.js"></script>
<script src="/js/a.js"></script><script src="/js/b.js"></script><script src="/js/c.js"></script><script src="/js/d.js"></script>
</head><body>
<center><font size="4">Bienvenidos a Ferretería Ejemplo</font></center>
<table width="960"><tr><td>
<img src="logo.gif"><img src="foto1.jpg"><img src="foto2.jpg" alt="Local">
<object data="intro.swf" type="application/x-shockwave-flash"></object>
<a href="nosotros.html">Nosotros</a> <a href="productos.html">Productos</a> <a href="#arriba"></a>
</td></tr></table>
<p>Llámenos al 4555-1234. Escríbanos a ventas@ferreteria-ejemplo.com.ar</p>
<p>© 2014 Ferretería Ejemplo</p>
</body></html>`;

const MODERN_SITE = `<!doctype html><html lang="es-AR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estudio Contable Ejemplo · Contadores en Córdoba</title>
<meta name="description" content="Estudio contable en Córdoba con 20 años de experiencia en monotributo, sociedades y sueldos. Pedí tu turno online.">
<link rel="canonical" href="https://estudio.test/">
<meta property="og:title" content="Estudio Contable Ejemplo"><meta property="og:image" content="https://estudio.test/og.jpg">
<script type="application/ld+json">{"@type":"AccountingService"}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>
</head><body>
<nav><a href="/servicios">Servicios</a><a href="/equipo">Equipo</a><a href="/contacto">Contacto</a></nav>
<h1>Contadores en Córdoba</h1>
<img src="/a.webp" alt="Oficina" width="800" height="600">
<a href="https://wa.me/5493515550000">Escribinos por WhatsApp</a>
<a href="tel:+543515550000">Llamar</a>
<a href="mailto:hola@estudio.test?subject=Consulta">hola@estudio.test</a>
<a href="https://www.instagram.com/estudio.ejemplo/">Instagram</a>
<a href="https://www.linkedin.com/in/persona-privada">Perfil personal</a>
<a href="https://www.facebook.com/sharer.php?u=x">Compartir</a>
<form><label for="n">Nombre</label><input id="n" name="n"><button>Pedir turno</button></form>
<footer>© 2019–2026 Estudio Contable Ejemplo</footer>
</body></html>`;

function input(html: string, over: Partial<AuditInput> = {}): AuditInput {
  return {
    requestedUrl: "https://sitio.test/",
    finalUrl: "https://sitio.test/",
    status: 200,
    headers: {},
    html,
    ms: 400,
    bytes: Buffer.byteLength(html),
    truncated: false,
    robotsSitemaps: [],
    now,
    ...over,
  };
}

const status = (r: ReturnType<typeof auditHtml>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("auditoría técnica: sitio antiguo", () => {
  const r = auditHtml(input(OLD_SITE, { requestedUrl: "http://ferreteria.test/", finalUrl: "http://ferreteria.test/", ms: 3200 }));

  it("detecta los problemas medibles", () => {
    expect(status(r, "https")).toBe("fail");
    expect(status(r, "viewport")).toBe("fail");
    expect(status(r, "flash")).toBe("fail");
    expect(status(r, "lang")).toBe("fail");
    expect(status(r, "response-time")).toBe("fail");
    expect(status(r, "jquery")).toBe("warn");
    expect(status(r, "obsolete-tags")).toBe("warn");
    expect(status(r, "fixed-width")).toBe("warn");
    expect(status(r, "copyright-year")).toBe("fail");
    expect(status(r, "img-alt")).toBe("fail");
    expect(status(r, "blocking-scripts")).toBe("warn");
  });

  it("encuentra el email escrito como texto, pero no inventa un teléfono sin enlace", () => {
    expect(r.contacts).toEqual([{ field: "Email", value: "ventas@ferreteria-ejemplo.com.ar" }]);
    expect(status(r, "tel-link")).toBe("warn");
  });

  it("puntúa bajo y describe los problemas sin lenguaje despectivo", () => {
    expect(r.siteScore).not.toBeNull();
    expect(r.siteScore!).toBeLessThan(50);
    expect(r.issues[0]).toMatch(/HTTPS|celulares|Flash|idioma|código/);
    for (const i of r.issues) expect(i).not.toMatch(/horrible|feo|malo|pésimo|desastre|viejo/i);
  });

  it("recomienda contactar con urgencia alta", () => {
    const rec = recommend(r, { skipIfSiteScoreAbove: 80, requirePublicContact: true });
    expect(rec).toMatchObject({ action: "contactar", urgency: "alta", preliminary: true });
  });
});

describe("auditoría técnica: sitio moderno", () => {
  const r = auditHtml(
    input(MODERN_SITE, {
      requestedUrl: "https://estudio.test/",
      finalUrl: "https://estudio.test/",
      headers: { "strict-transport-security": "max-age=1", "content-encoding": "br" },
      robotsSitemaps: ["https://estudio.test/sitemap.xml"],
      links: [
        { url: "https://estudio.test/servicios", status: 200 },
        { url: "https://estudio.test/equipo", status: 404 },
      ],
    }),
  );

  it("reconoce lo que está bien", () => {
    for (const id of ["https", "viewport", "title", "meta-description", "h1", "canonical", "open-graph", "structured-data", "analytics", "cta", "whatsapp", "tel-link", "form-labels", "sitemap", "copyright-year"]) {
      expect(status(r, id), id).toBe("pass");
    }
    expect(r.strengths.length).toBeGreaterThan(3);
  });

  it("detecta el enlace roto con su URL", () => {
    const c = r.checks.find((x) => x.id === "broken-links")!;
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("https://estudio.test/equipo (404)");
  });

  it("extrae contactos empresariales, no perfiles personales ni enlaces para compartir", () => {
    const fields = r.contacts.map((c) => `${c.field}:${c.value}`);
    expect(fields).toContain("WhatsApp:https://wa.me/5493515550000");
    expect(fields).toContain("Teléfono:+543515550000");
    expect(fields).toContain("Email:hola@estudio.test");
    expect(fields).toContain("Instagram:https://www.instagram.com/estudio.ejemplo");
    expect(fields.join()).not.toMatch(/linkedin|sharer/);
  });

  it("deja sin puntaje las categorías que requieren criterio humano", () => {
    for (const k of ["diseno", "claridad", "contenido", "automatizacion"] as const) {
      expect(r.categories[k]).toMatchObject({ score: null, measured: false });
    }
    expect(r.categories.seo.measured).toBe(true);
  });

  it("puntúa alto y, sobre el umbral, recomienda descartar", () => {
    expect(r.siteScore!).toBeGreaterThan(80);
    expect(recommend(r, { skipIfSiteScoreAbove: 80, requirePublicContact: true }).action).toBe("descartar");
  });
});

describe("auditoría técnica: casos especiales", () => {
  it("noindex en la página principal es un problema grave", () => {
    const r = auditHtml(input(`<html lang="es"><head><meta name="robots" content="noindex"></head><body></body></html>`));
    expect(status(r, "indexable")).toBe("fail");
  });

  it("contenido mixto activo en HTTPS", () => {
    const r = auditHtml(input(`<html><head><script src="http://cdn.test/x.js"></script></head></html>`));
    expect(status(r, "mixed-content")).toBe("fail");
  });

  it("sin contacto público: observar", () => {
    const r = auditHtml(input(`<html><head><title>x</title></head><body>hola</body></html>`, { finalUrl: "http://x.test/" }));
    expect(recommend(r, { skipIfSiteScoreAbove: 80, requirePublicContact: true }).action).toBe("observar");
  });

  it("no toma nombres de imágenes como emails", () => {
    const r = auditHtml(input(`<html><body><img src="logo@2x.png"> logo@2x.png</body></html>`));
    expect(r.contacts).toEqual([]);
  });
});

describe("enlaces internos", () => {
  it("solo del mismo dominio, sin anclas, archivos ni la página actual", () => {
    const links = extractInternalLinks(
      `<a href="/a">a</a><a href="https://www.sitio.test/b#x">b</a><a href="https://otro.test/c">c</a>
       <a href="/menu.pdf">pdf</a><a href="#top">top</a><a href="mailto:x@y.z">m</a><a href="/">home</a><a href="/a">dup</a>`,
      "https://sitio.test/",
    );
    expect(links).toEqual(["https://sitio.test/a", "https://www.sitio.test/b"]);
  });
});
