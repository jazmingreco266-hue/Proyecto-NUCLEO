import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallSupport } from "./ui/install-support";

// Todo el panel se renderiza por request: así cada página lleva el nonce de la CSP
// y nunca se sirve una versión cacheada con datos de otra persona.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Núcleo · Panel", template: "%s · Núcleo" },
  description: "Panel operativo privado de Núcleo.",
  applicationName: "Núcleo",
  appleWebApp: { capable: true, title: "Núcleo", statusBarStyle: "default" },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfbfa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <InstallSupport />
      </body>
    </html>
  );
}
