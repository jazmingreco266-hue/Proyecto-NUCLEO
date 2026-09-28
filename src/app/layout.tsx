import type { Metadata, Viewport } from "next";
import "./globals.css";

// Todo el panel se renderiza por request: así cada página lleva el nonce de la CSP
// y nunca se sirve una versión cacheada con datos de otra persona.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Claude Workers · Panel", template: "%s · Claude Workers" },
  description: "Panel operativo privado de Claude Workers.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#161b27" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4f8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
