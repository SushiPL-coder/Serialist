// ══════════════════════════════════════════════════════════════════════
//  SERIALIST — sw.js (Service Worker)
//  Author: SushiPL-coder | https://github.com/SushiPL-coder/Serialist | MIT License
// ══════════════════════════════════════════════════════════════════════

const CACHE   = 'serialist-v1';
const ASSETS  = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json',
                 '/icons/icon-192.svg', '/icons/icon-512.svg'];

// ── Install: cache static assets ────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-first for API ─────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network only
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

// ── Push Notifications ───────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'Serialist', body: 'Nowy odcinek do obejrzenia!', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.svg',
      badge:   '/icons/icon-192.svg',
      tag:     data.tag || 'serialist-episode',
      data:    { url: data.url || '/' },
      actions: [
        { action: 'watch', title: '▶ Obejrzane' },
        { action: 'later', title: '⏰ Później'  },
      ],
    })
  );
});

// ── Notification Click ───────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';

  if (e.action === 'watch') {
    // Could POST to mark as watched — for now just open app
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then(c => c.navigate(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});
