import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = "https://nucleo-pyme.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Núcleo — El sistema operativo de tu empresa",
  description:
    "Núcleo transforma tus audios, planillas y documentos desordenados en un portal privado con manuales, procesos, plantillas y calculadoras. El sistema operativo de tu PyME.",
  keywords: [
    "sistematización de PyMEs",
    "documentación de procesos",
    "manuales operativos",
    "portal privado empresa",
    "consultoría de procesos",
  ],
  openGraph: {
    title: "Núcleo — El sistema operativo de tu empresa",
    description:
      "Transformamos tus audios, planillas y documentos desordenados en un sistema profesional para manejar tu empresa.",
    url: siteUrl,
    siteName: "Núcleo",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Núcleo — El sistema operativo de tu empresa",
    description:
      "Transformamos tus audios, planillas y documentos desordenados en un sistema profesional para manejar tu empresa.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-screen flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
