// Service Worker de Yatay: por ahora no guarda nada en caché (todo va a la red, siempre datos frescos).
// Existe para que Chrome / Edge / Android ofrezcan "Instalar app". El soporte sin conexión, si algún día, va acá.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve la petición como siempre.
});
