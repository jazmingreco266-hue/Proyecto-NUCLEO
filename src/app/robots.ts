import type { MetadataRoute } from "next";

// El panel es privado: se pide a todos los buscadores que no lo recorran.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
