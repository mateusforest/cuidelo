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
      const valid = (s) => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);
      let route = '/cidadao/dia-a-dia';
      if (
        !test &&
        valid(data.id) &&
        valid(data.channel) &&
        Number.isSafeInteger(data.due) &&
        Array.isArray(data.items) &&
        data.items.length &&
        data.items.length <= 16 &&
        data.items.every(
          (t) =>
            t &&
            /^[a-f0-9-]{36}$/.test(t.planId) &&
            ['dose', 'pickup', 'renewal'].includes(t.kind) &&
            typeof t.when === 'string' &&
            t.when.length <= 16,
        )
      ) {
        try {
          const cache = await caches.open('cuidelo-push-actions-v1');
          await cache.put(
            '/cidadao/.avisos/' + data.channel + '/' + data.id,
            new Response(JSON.stringify({ due: data.due, zone: data.zone, items: data.items }), {
              headers: { Date: new Date().toUTCString() },
            }),
          );
          route += '/aviso/' + data.channel + '/' + data.id;
          for (const key of await cache.keys()) {
            const cached = await cache.match(key);
            if (Date.parse(cached?.headers.get('Date')) < Date.now() - 7 * 86400000)
              await cache.delete(key);
          }
        } catch {
          /* O aviso genérico continua disponível sem armazenamento local. */
        }
      }
      await self.registration.showNotification(
        test ? 'Cuidelo · teste de aviso' : 'Cuidelo · lembrete pessoal',
        {
          body: test
            ? 'O aviso de teste chegou a este aparelho.'
            : 'Você tem um horário ou uma data para conferir em Dia a dia.',
          data: { route },
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
      const stored = event.notification.data?.route;
      const route =
        typeof stored === 'string' &&
        /^\/cidadao\/dia-a-dia\/aviso\/[a-f0-9]{32}\/[a-f0-9]{32}$/.test(stored)
          ? stored
          : '/cidadao/dia-a-dia';
      const windows = await self.clients.matchAll({ type: 'window' });
      const citizen = windows.find((client) => new URL(client.url).pathname.startsWith('/cidadao'));
      if (citizen) {
        try {
          const target = await citizen.navigate(route);
          if (target) {
            await target.focus();
            return;
          }
        } catch {
          /* A janela pode ter sido fechada enquanto a notificação estava visível. */
        }
      }
      await self.clients.openWindow(route);
    })(),
  );
});
