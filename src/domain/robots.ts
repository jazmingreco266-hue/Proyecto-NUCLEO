/**
 * Lectura de robots.txt según RFC 9309.
 *
 * - Se usa el grupo cuyo user-agent coincide con el nuestro; si no hay, el grupo "*".
 * - Gana la regla que coincide con más caracteres; ante empate, Allow.
 * - Soporta los comodines "*" y "$".
 * También se leen Crawl-delay y Sitemap, que no son parte del RFC pero son de uso común.
 */

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[]; crawlDelay: number | null };

export type Robots = {
  groups: Group[];
  sitemaps: string[];
};

/** Tope de lectura recomendado por el RFC: 500 KiB. */
export const ROBOTS_MAX_BYTES = 500 * 1024;

export function parseRobots(text: string): Robots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.slice(0, ROBOTS_MAX_BYTES).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // "Disallow:" vacío no prohíbe nada.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function groupFor(robots: Robots, userAgentToken: string): Group | null {
  const token = userAgentToken.toLowerCase();
  const matching = robots.groups.filter((g) => g.agents.some((a) => a !== "*" && a === token));
  const pick = matching.length ? matching : robots.groups.filter((g) => g.agents.includes("*"));
  if (!pick.length) return null;
  // Varios grupos para el mismo agente se combinan (RFC 9309, 2.2.1).
  return {
    agents: pick.flatMap((g) => g.agents),
    rules: pick.flatMap((g) => g.rules),
    crawlDelay: pick.map((g) => g.crawlDelay).find((d) => d != null) ?? null,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.+?^{}()|[\]\\]/g, "\\$&");
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + body.split("*").map(escapeRegex).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

/** Normaliza la ruta para comparar: decodifica lo seguro y conserva la query. */
function normalizePath(pathWithQuery: string): string {
  try {
    return decodeURI(pathWithQuery || "/");
  } catch {
    return pathWithQuery || "/";
  }
}

export function isAllowed(robots: Robots, userAgentToken: string, pathWithQuery: string): boolean {
  if (pathWithQuery === "/robots.txt") return true;
  const g = groupFor(robots, userAgentToken);
  if (!g) return true;
  const path = normalizePath(pathWithQuery);
  let best: Rule | null = null;
  for (const r of g.rules) {
    const pattern = normalizePath(r.pattern);
    if (!matches(pattern, path)) continue;
    if (
      !best ||
      pattern.length > normalizePath(best.pattern).length ||
      (pattern.length === normalizePath(best.pattern).length && r.allow)
    ) {
      best = r;
    }
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(robots: Robots, userAgentToken: string): number | null {
  return groupFor(robots, userAgentToken)?.crawlDelay ?? null;
}

/** Robots que permite todo (robots.txt inexistente: 4xx distinto de 401/403). */
export const ALLOW_ALL: Robots = { groups: [], sitemaps: [] };
/** Robots que prohíbe todo (no se pudo leer o el servidor negó el acceso). */
export const DISALLOW_ALL: Robots = {
  groups: [{ agents: ["*"], rules: [{ allow: false, pattern: "/" }], crawlDelay: null }],
  sitemaps: [],
};
