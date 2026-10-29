import { selectSession } from './session';
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('recepção publica senha na TV da unidade e a rechamada não duplica o histórico', async ({
  page,
}) => {
  await page.goto('/senhas');
  await selectSession(page, { unitId: 'aurora-centro' });
  await page.getByLabel('Local para chamar a próxima senha').selectOption('consultorio-2');
  const pop = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Abrir TV desta unidade', exact: true }).click();
  const tv = await pop;
  await expect(tv.getByRole('heading', { name: 'Aguarde sua senha.' })).toBeVisible();
  const first = page.getByRole('button', { name: /^Chamar senha A-/ }).first(),
    label = await first.getAttribute('aria-label'),
    ticket = label!.replace('Chamar senha ', '');
  await first.click();
  await expect(page.getByRole('status')).toContainText('Senha chamada');
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket, { timeout: 10000 });
  await expect(tv.getByRole('region', { name: 'Chamada atual' })).toContainText('Consultório 02');
  await expect(tv.getByText('João Pedro Souza', { exact: true })).toHaveCount(0);
  await expect(tv.getByText('DEMO-0002', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chamar novamente', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('novamente');
  await expect(tv.locator('.tv-history li')).toHaveCount(0);
  await tv.reload();
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket);
  await tv.goto('/painel?rede=horizonte&unidade=horizonte-centro');
  await expect(tv.getByRole('heading', { name: 'Aguarde sua senha.' })).toBeVisible();
});

test('HTML abre diretamente, sem rede, com navegação, fontes, marca e guia incorporados', async ({
  page,
  context,
}) => {
  const errors: string[] = [],
    network: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await context.setOffline(true);
  await page.goto(pathToFileURL(path.resolve('dist-standalone/Cuidelo.html')).href);
  await expect(page.getByRole('heading', { name: 'Visão da rede', exact: true })).toBeVisible();
  expect(
    await page
      .locator('.brand-lockup img')
      .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
  ).toBe(true);
  await selectSession(page, { unitId: 'aurora-centro' });
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Painel de senhas', exact: true })
    .click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Abrir TV desta unidade', exact: true }).click();
  const tv = await popup;
  const call = page.getByRole('button', { name: /^Chamar senha A-/ }).first();
  const ticket = (await call.getAttribute('aria-label'))!.replace('Chamar senha ', '');
  await call.click();
  await expect(page.getByRole('status')).toContainText('Senha chamada');
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket, { timeout: 10000 });
  await page.getByRole('link', { name: 'Comparar com Pulso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'O que veio do Pulso' })).toBeVisible();
  await expect(page.locator('.coverage-table tbody tr')).toHaveCount(46);
  await page.reload();
  await expect(page.locator('.coverage-table tbody tr')).toHaveCount(46);
  await page.getByRole('link', { name: 'Plano de entrega', exact: true }).click();
  const guidePop = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Guia da marca' }).click();
  const guide = await guidePop;
  await expect(guide.getByRole('heading', { name: 'Confiança, com leveza.' })).toBeVisible();
  expect(
    await guide
      .locator('.hero img')
      .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});

test('HTML da TV abre a prévia, simula chamada e cabe em 1080p e 720p', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(pathToFileURL(path.resolve('dist-standalone/Cuidelo-TV.html')).href);
  await expect(page.getByTestId('current-ticket')).toHaveText('A-023');
  await page.getByRole('button', { name: 'Simular chamada' }).click();
  await expect(page.getByTestId('current-ticket')).toHaveText('A-024');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.mouse.move(100, 100);
  await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair da tela cheia', exact: true })).toBeVisible();
});

test('controle de senhas no celular mantém chamada acessível sem rolagem lateral da página', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/senhas');
  await selectSession(page, { unitId: 'aurora-centro' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const call = page.getByRole('button', { name: /^Chamar senha A-/ }).first();
  await call.scrollIntoViewIfNeeded();
  await expect(call).toBeInViewport();
  await call.click();
  await expect(page.getByRole('status')).toContainText('Senha chamada');
});
