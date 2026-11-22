// Lifebgood sin señal: guarda la app y los mapas que ya viste en el celu.
const V = 'lb-app-2', TILES = 'lb-tiles';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/data.js', 'js/parse.js', 'js/juegos.js', 'js/app.js', 'icon.svg', 'icon-192.png', 'manifest.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
let trimming = false;
async function trim(c) { if (trimming) return; trimming = true; try { const ks = await c.keys(); if (ks.length > 3000) for (const k of ks.slice(0, ks.length - 3000)) await c.delete(k); } finally { trimming = false; } }
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // mapas: primero lo guardado (abre al instante), y se actualiza por detrás
  if (u.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) { c.put(e.request, r.clone()); trim(c); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // la app, Leaflet y las letras: lo guardado al toque, y la versión nueva para la próxima vez
  if (u.origin === location.origin || u.hostname === 'cdnjs.cloudflare.com' || u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
