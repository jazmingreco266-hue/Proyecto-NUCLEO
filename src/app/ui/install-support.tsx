"use client";

import { useEffect } from "react";

/** Registra el service worker que permite instalar el panel como app. */
export function InstallSupport() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si el navegador no lo permite, el panel funciona igual; solo no se ofrece instalarlo.
      });
    }
  }, []);
  return null;
}
