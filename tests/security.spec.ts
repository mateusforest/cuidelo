import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectSession } from './session';
test('encerrar a estação fecha duas abas sem apagar o cadastro e uma sessão vencida não reabre', async ({
  page,
  context,
}) => {
  await page.goto('/pessoas');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const second = await context.newPage();
  await second.goto('/pessoas');
  const before = await page.evaluate(() => localStorage.getItem('cuidelo.demo.database.v1'));
  await second.evaluate(() =>
    sessionStorage.setItem('cuidelo.report.read.v1.teste', 'código-fictício'),
  );
  await expect(second.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
  for (const tab of [page, second])
    await expect(tab.getByRole('button', { name: 'Entrar na demonstração' })).toBeVisible();
  expect(
    await second.evaluate(() => sessionStorage.getItem('cuidelo.report.read.v1.teste')),
  ).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.database.v1'))).toBe(before);
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.clock.setFixedTime(new Date(Date.now() + 16 * 60000));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar na demonstração' })).toBeVisible();
});
test('as APIs rejeitam formulários externos, excesso de dados, campos extras e credenciais ausentes', async ({
  request,
}) => {
  for (const name of ['tv', 'remessas', 'cidadao', 'care-push']) {
    const url = '/api/' + name;
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      request.post(url, { data: body as object, headers });
    expect((await post({ op: 'health' }, { origin: 'https://externo.invalid' })).status()).toBe(
      403,
    );
    expect((await post('{"op":"health"}', { 'content-type': 'text/plain' })).status()).toBe(415);
    expect((await post({ op: 'health', dados: 'não permitido' })).status()).toBe(400);
  }
  expect(
    (
      await request.post('/api/remessas', {
        data: { op: 'receive', org: 'aurora', unit: 'aurora-centro', role: 'pharmacy' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/remessas', { data: { op: 'health', extra: 'á'.repeat(8200) } })
    ).status(),
  ).toBe(413);
});
test('HTML baixado executa o aplicativo e bloqueia scripts injetados', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#/acesso');
  await expect(page.getByRole('button', { name: 'Entrar na demonstração' })).toBeVisible();
  const ran = await page.evaluate(() => {
    const el = document.createElement('script');
    el.textContent = "document.body.dataset.injected='sim'";
    document.body.append(el);
    return document.body.dataset.injected;
  });
  expect(ran).toBeUndefined();
});
