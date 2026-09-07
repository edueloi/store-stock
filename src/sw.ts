/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// __WB_MANIFEST é injetado pelo vite-plugin-pwa (injectManifest) na hora do
// build — mesma lista de arquivos que globPatterns/globIgnores produziam antes.
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api/],
  })
);

registerRoute(
  /^\/api\/products/,
  new NetworkFirst({
    cacheName: "pdv-products",
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 300 })],
  })
);

// ─── Push notifications ──────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "BoxSys PDV", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "BoxSys PDV", {
      body: payload.body || "",
      icon: "/logo-boxsys-vazado.png",
      badge: "/logo-boxsys-vazado.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => new URL(c.url).pathname === url);
      if (existing) {
        existing.focus();
        return;
      }
      const anyClient = allClients[0];
      if (anyClient) {
        anyClient.focus();
        anyClient.navigate(url);
        return;
      }
      self.clients.openWindow(url);
    })()
  );
});
