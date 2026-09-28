import type { MetadataRoute } from "next";

/** Permite instalar el panel como app en computadora, tablet y celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Núcleo · Panel operativo",
    short_name: "Núcleo",
    description: "Panel operativo privado de Núcleo.",
    lang: "es-AR",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
