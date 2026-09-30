import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // El panel es privado: ningún buscador debe indexarlo.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

// Identifica cada versión publicada. En Vercel es el commit desplegado; en local, la hora del build.
// Se fija al compilar, así la página abierta y el servidor pueden comparar si hay una versión nueva.
const appVersion = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { NUCLEO_VERSION: appVersion },
  serverExternalPackages: ["pg", "bcryptjs"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
