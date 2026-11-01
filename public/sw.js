self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }
  const token = payload.token || '';
  const actions = (payload.actions || ['started', 'used', 'done']).map((act) => {
    if (act === 'started') return { action: 'started', title: 'Started' };
    if (act === 'used') return { action: 'used', title: 'Used 1' };
    return { action: 'done', title: 'Done' };
  });

  event.waitUntil(self.registration.showNotification(payload.title || 'Reminder', {
    body: 'Reminder',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { token },
    actions,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const token = (event.notification.data && event.notification.data.token) || '';

  if (event.action && token) {
    event.waitUntil(
      fetch('/api/v1/notifications/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-padzyra': '1' },
        body: JSON.stringify({ token, action: event.action }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json && json.data && (json.data.needNow || json.data.shops)) {
            return clients.openWindow('/#/now');
          }
          return clients.openWindow('/#/home');
        })
        .catch(() => clients.openWindow('/#/home'))
    );
  } else if (token) {
    event.waitUntil(clients.openWindow(`/#/act?token=${encodeURIComponent(token)}`));
  } else {
    event.waitUntil(clients.openWindow('/#/home'));
  }
});
