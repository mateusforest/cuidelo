export const supportsAlerts = () => location.protocol === 'https:' || window.isSecureContext;
export async function enableCareAlerts() {
  if (
    !supportsAlerts() ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    location.protocol === 'file:'
  )
    throw Error(
      'Este navegador não oferece o aviso do aparelho. Use os lembretes na tela ou o calendário.',
    );
  if ((await Notification.requestPermission()) !== 'granted')
    throw Error(
      'Permissão não concedida. Os lembretes continuam na tela e podem ser adicionados ao calendário.',
    );
  const reg = await navigator.serviceWorker.register('/citizen-alarm-worker.js', {
    scope: '/cidadao/',
  });
  if (!reg.active)
    await new Promise<void>((resolve, reject) => {
      const worker = reg.installing ?? reg.waiting;
      if (!worker) {
        reject(Error('Os avisos ainda não estão disponíveis. Tente novamente.'));
        return;
      }
      const done = () => {
        if (worker.state !== 'activated') return;
        clearTimeout(timer);
        worker.removeEventListener('statechange', done);
        resolve();
      };
      const timer = setTimeout(() => {
        worker.removeEventListener('statechange', done);
        reject(Error('O navegador não ativou os avisos. Use o calendário ou tente novamente.'));
      }, 8000);
      worker.addEventListener('statechange', done);
      done();
    });
}
export async function showCareAlert(tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted')
    throw Error('Permita as notificações deste site ou use os avisos do calendário.');
  const r = await navigator.serviceWorker.getRegistration('/cidadao/');
  if (!r?.active) throw Error('O navegador não ativou os avisos. Confira os lembretes na tela.');
  await r.showNotification('Cuidelo · lembrete pessoal', {
    body: 'Você tem um horário ou uma data para conferir em Dia a dia.',
    tag,
    icon: '/brand/simbolo.svg',
  });
}
