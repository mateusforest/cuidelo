import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const portable of [false, true]) {
  test(
    'remessa conectada entre computadores com duas parcelas · ' +
      (portable ? 'HTML baixado' : 'web'),
    async ({ page: source, browser, baseURL }) => {
      test.setTimeout(100000);
      const origin = baseURL!,
        base = portable
          ? pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#'
          : origin;
      const destination = await browser.newContext({
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 390, height: 844 },
      });
      const dest = await destination.newPage();
      const entries = (p: Page) => p.getByRole('region', { name: 'Transferências da unidade' });
      const lot = (p: Page) =>
        p
          .getByRole('region', { name: 'Estoque e movimentações', exact: true })
          .getByRole('row')
          .filter({ has: p.getByRole('cell', { name: 'CD-DEMO-01', exact: true }) });
      const enter = async (p: Page, unit: string) => {
        await p.goto(base + '/acesso?sessao=' + unit + '%3Apharmacy');
        await p.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
      };
      const field = (p: Page) =>
        p.getByRole('dialog').getByLabel('Código da remessa', { exact: true });
      async function connect(code: string) {
        await dest.getByRole('button', { name: 'Conectar remessa por código' }).click();
        await field(dest).fill(code);
        await dest.getByRole('button', { name: 'Conectar à unidade' }).click();
      }
      const reroute = portable && !origin.startsWith('https://cuidelo.vercel.app');
      if (reroute)
        await source.route('https://cuidelo.vercel.app/api/remessas', async (route) => {
          const res = await source.request.post(origin + '/api/remessas', {
            headers: { authorization: route.request().headers().authorization, origin: 'null' },
            data: route.request().postDataJSON(),
          });
          await route.fulfill({ response: res });
        });
      // O servidor aceita a primeira parcela, mas a resposta à UBS se perde.
      let firstReceipt = true;
      // No site, a primeira confirmação é enviada duas vezes simultaneamente.
      await dest.route('**/api/remessas', async (route) => {
        const data = route.request().postDataJSON();
        const first = firstReceipt && data.op === 'receive';
        if (first) firstReceipt = false;
        if (!reroute && !first) {
          await route.continue();
          return;
        }
        const send = () =>
          dest.request.post(reroute ? origin + '/api/remessas' : route.request().url(), {
            headers: {
              authorization: route.request().headers().authorization,
              ...(portable ? { origin: 'null' } : {}),
            },
            data,
          });
        const [res, repeated] = await Promise.all([send(), first && !portable ? send() : null]);
        if (repeated) {
          expect([res.status(), repeated.status()]).toEqual([200, 200]);
          expect((await repeated.json()).receipts).toHaveLength(1);
        }
        if (portable && first && res.ok()) {
          await route.abort();
        } else await route.fulfill({ response: res });
      });
      try {
        await enter(source, 'aurora-central');
        await source.getByRole('button', { name: 'Expedir transferência', exact: true }).click();
        const form = source.getByRole('dialog');
        const lotSelect = form.getByLabel('Lote de origem');
        await lotSelect.selectOption({
          label: await lotSelect.locator('option').filter({ hasText: 'CD-DEMO-01' }).innerText(),
        });
        await form.getByLabel('Unidade de destino', { exact: true }).selectOption('aurora-centro');
        await form.getByLabel('Quantidade a expedir').fill('6');
        await form.getByLabel('Motivo', { exact: true }).fill('Reposição fictícia online');
        await form.getByLabel('Referência do comprovante').fill('EXP-ONLINE');
        await form.getByRole('checkbox').check();
        await form.getByRole('button', { name: 'Confirmar expedição' }).click();
        await source.getByRole('button', { name: 'Enviar para outro computador' }).click();
        const code = await field(source).inputValue({ timeout: 20000 });
        await expect(lot(source)).toContainText('Disponível · 18');
        await source.goto('about:blank');
        await enter(dest, 'aurora-vila');
        await connect(code);
        await expect(dest.getByRole('alert')).toContainText('autorizados', { timeout: 18000 });
        await enter(dest, 'aurora-centro');
        await connect(code);
        await expect(entries(dest)).toContainText('EXP-ONLINE', { timeout: 20000 });
        await expect(lot(dest)).toHaveCount(0);
        for (const [qty, received] of [
          [2, 2],
          [4, 6],
        ]) {
          await dest.getByRole('button', { name: 'Receber transferência', exact: true }).click();
          const editor = dest.getByRole('dialog');
          await editor
            .getByRole('spinbutton', { name: 'Quantidade recebida nesta parcela', exact: true })
            .fill(String(qty));
          await editor.getByLabel('Referência do comprovante').fill('REC-' + received);
          await editor.getByRole('checkbox').check();
          await editor.getByRole('button', { name: 'Confirmar recebimento' }).click();
          if (portable && received === 2) {
            await expect(editor.getByRole('alert')).toContainText('Sem confirmação', {
              timeout: 20000,
            });
            await dest.reload();
          }
          await expect(lot(dest)).toContainText('Disponível · ' + received, { timeout: 25000 });
          await expect(entries(dest)).toContainText(
            'Recebida · ' + received + ' · Em trânsito · ' + (6 - received),
          );
          await source.goto(base + '/farmacia');
          await expect(entries(source)).toContainText(
            'Recebida · ' + received + ' · Em trânsito · ' + (6 - received),
            { timeout: 25000 },
          );
          await expect(lot(source)).toContainText('Disponível · 18');
        }
        await dest.reload();
        await expect(
          entries(dest).getByRole('button', { name: 'Receber transferência', exact: true }),
        ).toHaveCount(0);
        await expect(lot(dest)).toContainText('Disponível · 6');
        await expect(entries(dest)).toContainText('REC-2');
        await expect(entries(dest)).toContainText('REC-6');
        expect(await dest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      } finally {
        await destination.close();
      }
    },
  );
}
