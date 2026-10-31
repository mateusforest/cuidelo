import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { selectSession } from './session';

test('Web Push real de orientação com o app fechado, destino específico e leitura no consultório', async ({
  page: doctor,
}) => {
  test.skip(
    process.env.CUIDELO_LIVE_GUIDANCE_PUSH !== '1',
    'Teste optativo com o provedor real de notificações.',
  );
  test.setTimeout(180000);
  const origin = process.env.CUIDELO_REPORT_TEST_ORIGIN || 'https://cuidelo.vercel.app';
  const folder = await mkdtemp(join(tmpdir(), 'cuidelo-guidance-push-'));
  const phone = await chromium.launchPersistentContext(folder, {
    channel: process.env.CUIDELO_BROWSER || 'chrome',
    headless: true,
    ignoreDefaultArgs: ['--disable-background-networking', '--disable-component-update'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 390, height: 844 },
  });
  let active = false,
    shared = false;
  try {
    await phone.grantPermissions(['notifications'], { origin });
    const create = await phone.newPage();
    await create.goto(origin + '/cidadao');
    await create.getByRole('button', { name: /Ana Clara/ }).click();
    await create.goto(origin + '/cidadao/dia-a-dia/relatorio');
    await create.getByRole('button', { name: 'Compartilhar relatório', exact: true }).click();
    await create.getByRole('button', { name: 'Autorizar e gerar código' }).click();
    const field = create.getByLabel('Código do relatório');
    await expect(field).toBeVisible({ timeout: 20000 });
    shared = true;
    const code = await field.inputValue();
    // Ativar depois de compartilhar também precisa ligar este relatório à inscrição.
    await create.getByRole('link', { name: 'Orientações', exact: true }).click();
    await create.getByRole('button', { name: 'Ativar avisos do aparelho' }).click();
    await expect(create.getByText(/Inscrição confirmada/)).toBeVisible({ timeout: 30000 });
    active = true;
    const probe = await phone.newPage();
    await probe.goto(origin + '/citizen-icons/192.png');
    await create.close();
    expect(phone.pages().some((p) => p.url().startsWith(origin + '/cidadao'))).toBe(false);
    await doctor.goto(origin + '/atendimento/aurora-centro-e0');
    await selectSession(doctor, { role: 'clinical', unitId: 'aurora-centro' });
    await doctor.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
    await doctor.getByRole('button', { name: 'Abrir relatório com código' }).click();
    await doctor.getByLabel('Código compartilhado pela pessoa').fill(code);
    await doctor.getByRole('button', { name: 'Consultar relatório' }).click();
    await doctor.getByRole('button', { name: 'Registrar revisão no prontuário' }).click();
    const title = 'Orientação fictícia para conferir no retorno.';
    await doctor.getByLabel('Orientação para a pessoa').fill(title);
    await doctor.getByRole('button', { name: 'Registrar e enviar orientação' }).click();
    await expect(
      doctor.getByText('Envio confirmado para o app do cidadão.', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const notice = () =>
      probe.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration('/cidadao/');
        const n = (await reg?.getNotifications())?.find(
          (n) => n.title === 'Cuidelo · nova orientação',
        );
        return n ? { route: n.data.route as string, body: n.body } : null;
      });
    await expect
      .poll(async () => !!(await notice()), { timeout: 100000, intervals: [1500, 2500] })
      .toBe(true);
    const received = (await notice())!;
    expect(received.body).not.toMatch(/Marina|Ana|fictícia|retorno|UBS/);
    expect(received.route).toMatch(
      /^\/cidadao\/dia-a-dia\/orientacao\/[a-f0-9]{32}\/[a-f0-9-]{36}$/,
    );
    await expect(
      doctor.getByText('Aguardando confirmação de leitura', { exact: true }),
    ).toBeVisible();
    console.log('Notificação apresentada pelo sistema de push sem nenhuma tela do cidadão aberta.');
    const opened = await phone.newPage();
    // A automação entrega o toque ao tratador instalado usando a notificação real do navegador.
    await opened.goto(origin + '/cidadao/');
    await opened.getByRole('button', { name: /João Pedro/ }).click();
    const sw = phone.serviceWorkers().find((w) => w.url().endsWith('/citizen-alarm-worker.js'))!;
    await sw.evaluate(async () => {
      const worker = self as any;
      const notification = (await worker.registration.getNotifications()).find(
        (n: Notification) => n.title === 'Cuidelo · nova orientação',
      );
      const event = new Event('notificationclick');
      let done: Promise<unknown> | undefined;
      Object.assign(event, {
        notification,
        waitUntil: (p: Promise<unknown>) => {
          done = p;
        },
      });
      worker.dispatchEvent(event);
      await done?.catch(() => {});
    });
    await expect(opened).toHaveURL(origin + received.route);
    await expect(opened.getByText(title, { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(opened.locator('.report-history article')).toHaveCount(1);
    await expect(
      doctor.getByText('Aguardando confirmação de leitura', { exact: true }),
    ).toBeVisible();
    await opened.close();
    const cold = await phone.newPage();
    await cold.goto(origin + received.route);
    await cold.getByRole('button', { name: 'Confirmar que li' }).click();
    await expect(doctor.locator('.report-history').getByText(/Leitura confirmada em/)).toBeVisible({
      timeout: 25000,
    });
    await cold.reload();
    await expect(cold.getByText(/Leitura confirmada em/)).toBeVisible();
    console.log(
      'Confirmados o destino da orientação, a ação explícita e o horário da leitura no consultório.',
    );
  } finally {
    try {
      if (shared || active) {
        const cleanup = await phone.newPage();
        await cleanup.goto(origin + '/cidadao');
        await cleanup.getByRole('button', { name: /Ana Clara/ }).click();
        if (shared) {
          await cleanup.goto(origin + '/cidadao/dia-a-dia/relatorio');
          await cleanup.getByRole('button', { name: 'Encerrar compartilhamento' }).click();
          await expect(cleanup.getByLabel('Código do relatório')).toHaveCount(0);
        }
        if (active) {
          await cleanup.goto(origin + '/cidadao/dia-a-dia/orientacoes');
          await cleanup.getByRole('button', { name: 'Desativar avisos do aparelho' }).click();
          await expect(
            cleanup.getByRole('button', { name: 'Ativar avisos do aparelho' }),
          ).toBeVisible({ timeout: 20000 });
          await cleanup.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration('/cidadao/');
            await (await r?.pushManager.getSubscription())?.unsubscribe();
          });
        }
      }
    } finally {
      await phone.close();
      if (
        dirname(resolve(folder)) === resolve(tmpdir()) &&
        basename(folder).startsWith('cuidelo-guidance-push-')
      )
        await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    }
  }
});
