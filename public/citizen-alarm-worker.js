// Exibe alertas solicitados pelo app aberto. Não armazena fichas nem agenda doses em segundo plano.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const citizen = windows.find((client) => new URL(client.url).pathname.startsWith('/cidadao'));
      if (citizen) {
        await citizen.focus();
        return;
      }
      await self.clients.openWindow('/cidadao/dia-a-dia');
    })(),
  );
});
