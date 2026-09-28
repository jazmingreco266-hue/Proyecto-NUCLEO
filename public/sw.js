// Service worker mínimo para que el panel se pueda instalar como app.
// A propósito NO guarda nada en caché: los datos del panel son privados y
// siempre se piden al servidor, así no quedan copias en el dispositivo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve cada pedido normalmente, por red.
});
