// O serviço de push acorda este worker mesmo quando nenhuma página do Cuidelo está aberta.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* Mantém o aviso discreto. */
  }
  const test = data.kind === 'test';
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        test ? 'Cuidelo · teste de aviso' : 'Cuidelo · lembrete pessoal',
        {
          body: test
            ? 'O aviso de teste chegou a este aparelho.'
            : 'Você tem um horário ou uma data para conferir em Dia a dia.',
          icon: '/citizen-icons/192.png',
          badge: '/citizen-icons/192.png',
          ...(typeof data.id === 'string' && /^[a-f0-9]{32}$/.test(data.id)
            ? { tag: 'cuidelo-' + data.id }
            : {}),
        },
      );
      if (/^[a-f0-9]{32}$/.test(data.channel)) {
        try {
          const cache = await caches.open('cuidelo-push-receipts-v1');
          await cache.put(
            '/cidadao/.receipt/' + data.channel + '/' + (test ? 'test' : 'reminder'),
            new Response(JSON.stringify({ kind: test ? 'test' : 'reminder', shownAt: Date.now() })),
          );
        } catch {
          /* O aviso já foi apresentado ao navegador. */
        }
      }
    })(),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const citizen = windows.find((client) => new URL(client.url).pathname.startsWith('/cidadao'));
      if (citizen) {
        const target = await citizen.navigate('/cidadao/dia-a-dia');
        await (target ?? citizen).focus();
        return;
      }
      await self.clients.openWindow('/cidadao/dia-a-dia');
    })(),
  );
});
