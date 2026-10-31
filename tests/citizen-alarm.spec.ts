import { expect, test } from '@playwright/test';
import { createHash, createCipheriv, randomBytes, randomUUID } from 'node:crypto';

const origin = process.env.CUIDELO_CARE_TEST_ORIGIN || 'http://127.0.0.1:43173';
test('toque no aviso abre o medicamento certo após fechar a aba e registra as três ações sem duplicar', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'], { origin });
  await context.addInitScript(() =>
    Object.defineProperty(PushManager.prototype, 'getSubscription', {
      value: async () => ({
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/qa', keys: {} }),
      }),
    }),
  );
  const schedules: any[] = [];
  let channel = '';
  await context.route('**/api/care-push', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { key: 'B' + 'a'.repeat(86) } });
    const data = r.request().postDataJSON();
    if (data.op === 'sync') {
      schedules.push(data.schedule);
      channel = createHash('sha256')
        .update('cuidelo-push-device:' + r.request().headers().authorization.substring(7))
        .digest('hex')
        .slice(0, 32);
    }
    await r.fulfill({ json: { active: data.op !== 'stop', testAt: null, acceptedAt: null } });
  });
  await page.goto(origin + '/cidadao');
  await page.getByRole('button', { name: /João Pedro/ }).click();
  await page.getByRole('link', { name: 'Dia a dia', exact: true }).click();
  await page.getByRole('link', { name: 'Medicação', exact: true }).click();
  const day = await page.evaluate(() => new Intl.DateTimeFormat('sv-SE').format(new Date()));
  await page.getByRole('button', { name: 'Novo lembrete' }).click();
  await page.getByLabel('Nome do medicamento').fill('Medicamento fictício Q');
  await page.getByLabel('Horários diários').fill('00:00');
  await page.getByLabel('Próxima retirada', { exact: true }).fill(day);
  await page.getByLabel('Próxima renovação', { exact: true }).fill(day);
  await page.getByRole('button', { name: 'Salvar lembrete' }).click();
  await page.getByRole('button', { name: 'Ativar avisos do aparelho' }).click();
  await expect(page.getByRole('button', { name: 'Testar em 1 minuto' })).toBeVisible();
  const ref = schedules.at(-1).plans[0].ref;
  const p = await context.newPage();
  await p.goto(origin + '/cidadao/');
  await p.getByRole('button', { name: /Ana Clara/ }).click();
  await page.close();
  const id = 'e'.repeat(32),
    route = '/cidadao/dia-a-dia/aviso/' + channel + '/' + id;
  const cdp = await context.newCDPSession(p);
  let reg = '';
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
    reg = e.registrations.find((r) => r.scopeURL === origin + '/cidadao/')?.registrationId || reg;
  });
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => reg).toBeTruthy();
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId: reg,
    data: JSON.stringify({
      id,
      channel,
      due: Date.now(),
      zone: 'America/Sao_Paulo',
      kind: 'reminder',
      items: [
        { planId: ref, kind: 'dose', when: day + 'T00:00' },
        { planId: ref, kind: 'pickup', when: day },
        { planId: ref, kind: 'renewal', when: day },
      ],
    }),
  });
  await expect
    .poll(() =>
      p.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration('/cidadao/');
        return (await r?.getNotifications())?.[0]?.data?.route;
      }),
    )
    .toBe(route);
  const worker = context
    .serviceWorkers()
    .find((w) => w.url().endsWith('/citizen-alarm-worker.js'))!;
  // O Chrome não disponibiliza o toque físico pela automação. Entrega o evento ao tratador instalado.
  await worker.evaluate(async () => {
    const sw = self as any,
      notification = (await sw.registration.getNotifications())[0];
    const e = new Event('notificationclick');
    let done: Promise<unknown> | undefined;
    Object.assign(e, {
      notification,
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
    });
    sw.dispatchEvent(e);
    await done?.catch(() => {});
  });
  await expect(p).toHaveURL(origin + route);
  await expect(p.getByText(/João Pedro Souza ·/).first()).toBeVisible();
  const dose = p.locator('article').filter({ hasText: 'Horário do remédio' });
  await dose.getByLabel('Lembrar novamente em').selectOption('1');
  await dose.getByRole('button', { name: 'Adiar lembrete' }).click();
  await expect(dose.getByText(/Aviso adiado para/)).toBeVisible();
  await expect.poll(() => schedules.at(-1).plans[0].later.length).toBe(1);
  await p.close();
  const cold = await context.newPage();
  await cold.goto(origin + route);
  await cold.getByRole('button', { name: 'Marcar que tomei' }).click();
  await expect(cold.getByText(/Registrado no Dia a dia · tomei/)).toBeVisible();
  await expect.poll(() => schedules.at(-1).plans[0].later.length).toBe(0);
  await cold.getByRole('button', { name: 'Confirmar retirada' }).click();
  await cold.getByRole('button', { name: 'Confirmar renovação' }).click();
  await cold.reload();
  await expect(cold.getByText('Confirmação registrada no Dia a dia.')).toHaveCount(2);
  await expect(cold.getByRole('button', { name: 'Marcar que tomei' })).toHaveCount(0);
  await cold.getByRole('button', { name: 'Ver meu Dia a dia' }).click();
  await cold.getByRole('link', { name: 'Relatório', exact: true }).click();
  await expect(cold.locator('.care-report')).toContainText('Aviso adiado');
  await expect(cold.locator('.care-report')).toContainText('Informou que tomou');
  await cold.getByRole('button', { name: 'Sair do app do cidadão' }).click();
  await cold.goto(origin + route);
  await expect(cold.getByText(/Reabra seu acesso do cidadão/)).toBeVisible();
  await cold.goto(origin + route.replace(channel, '0'.repeat(32)));
  await expect(cold.getByText(/expirou, foi desativado/)).toBeVisible();
  await expect(cold.getByText('Medicamento fictício Q')).toHaveCount(0);
});

test('aviso de link da unidade revalida a cópia e bloqueia uma confirmação após revogação', async ({
  page,
  context,
}) => {
  const bytes = randomBytes(32),
    iv = randomBytes(12),
    reader = randomBytes(32).toString('hex'),
    subject = 'share:' + randomUUID();
  const view = {
    version: 1,
    person: 'Pessoa fictícia da unidade',
    organization: 'Rede de teste',
    asOf: new Date().toISOString(),
    appointments: [],
    documents: [],
    careScope: { organization: 'rede-qa', subject },
  };
  const c = createCipheriv('aes-256-gcm', bytes, iv);
  const payload = Buffer.concat([
    iv,
    c.update(JSON.stringify(view), 'utf8'),
    c.final(),
    c.getAuthTag(),
  ]).toString('base64url');
  const expires = Date.now() + 3600000,
    owner = randomBytes(32).toString('hex'),
    id = randomBytes(16).toString('hex');
  const channel = createHash('sha256')
    .update('cuidelo-push-device:' + owner)
    .digest('hex')
    .slice(0, 32);
  let revoked = false;
  await context.route('**/api/cidadao', (r) =>
    r.fulfill(revoked ? { status: 410, json: {} } : { json: { payload, expires } }),
  );
  await context.route('**/api/care-push', (r) => r.fulfill({ json: { active: true } }));
  await context.addInitScript(() =>
    Object.defineProperty(PushManager.prototype, 'getSubscription', {
      value: async () => ({
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/qa', keys: {} }),
      }),
    }),
  );
  await context.grantPermissions(['notifications'], { origin });
  await page.goto(origin + '/cidadao#v1.' + reader + '.' + bytes.toString('base64url'));
  await page.getByRole('link', { name: 'Dia a dia', exact: true }).click();
  await page.getByRole('link', { name: 'Medicação', exact: true }).click();
  await page.getByRole('button', { name: 'Novo lembrete' }).click();
  await page.getByLabel('Nome do medicamento').fill('Exemplo restrito à cópia');
  await page.getByLabel('Horários diários').fill('00:00');
  await page.getByRole('button', { name: 'Salvar lembrete' }).click();
  await expect(page.locator('.care-med')).toContainText('Exemplo restrito à cópia');
  const url = origin + '/cidadao/dia-a-dia/aviso/' + channel + '/' + id;
  await page.evaluate(
    async ({ subject, reader, key, channel, id, owner }) => {
      const k = JSON.stringify(['citizen', 'rede-qa', 'personal', subject]);
      localStorage.setItem(
        'cuidelo.push.v1.' + k,
        JSON.stringify({
          owner,
          want: true,
          confirmed: true,
          revision: 1,
          signature: '',
          resumeLink: { reader, key },
        }),
      );
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('cuidelo.citizen.care.v1');
        r.onsuccess = () => resolve(r.result);
      });
      const planId = await new Promise<string>((resolve) => {
        const r = db.transaction('journals').objectStore('journals').get(k);
        r.onsuccess = () => resolve(r.result.plans[0].id);
      });
      db.close();
      await navigator.serviceWorker.register('/citizen-alarm-worker.js', { scope: '/cidadao/' });
      const day = new Intl.DateTimeFormat('sv-SE').format(new Date());
      await (
        await caches.open('cuidelo-push-actions-v1')
      ).put(
        '/cidadao/.avisos/' + channel + '/' + id,
        new Response(
          JSON.stringify({
            due: Date.now(),
            zone: 'America/Sao_Paulo',
            items: [{ planId, kind: 'dose', when: day + 'T00:00' }],
          }),
        ),
      );
    },
    { subject, reader, key: bytes.toString('base64url'), channel, id, owner },
  );
  await page.close();
  const cold = await context.newPage();
  await cold.goto(url);
  await expect(cold.getByRole('heading', { name: 'Exemplo restrito à cópia' })).toBeVisible();
  revoked = true;
  await cold.getByRole('button', { name: 'Marcar que tomei' }).click();
  await expect(cold.getByText(/Este link expirou ou foi encerrado/)).toBeVisible();
  await cold.reload();
  await expect(cold.getByRole('heading', { name: 'Acesso indisponível' })).toBeVisible();
  await expect(cold.getByRole('button', { name: 'Marcar que tomei' })).toHaveCount(0);
});
