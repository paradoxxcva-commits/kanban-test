self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data.json(); } catch (_) { data = { title: 'Планка', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Планка', {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'planka-push',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(url) !== -1 && 'focus' in c) return c.focus();
    }
    return clients.openWindow(url);
  }));
});
