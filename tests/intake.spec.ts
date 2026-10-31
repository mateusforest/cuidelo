import { selectSession } from './session';
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('escuta → aferição → correção → consulta → complemento e histórico preservado', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await selectSession(page, { role: 'nursing' });
  await page.getByRole('link', { name: 'Escuta e sinais vitais', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Ana Clara Martins' });
  await row.getByRole('link', { name: 'Registrar escuta' }).click();
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await page
    .getByLabel('Motivo da procura', { exact: true })
    .fill('Relato fictício para testar a escuta.');
  await page.getByLabel('Pressão sistólica (mmHg)', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('duas medidas');
  await page.getByLabel('Pressão diastólica (mmHg)', { exact: true }).fill('80');
  await page.getByLabel('Temperatura (°C)', { exact: true }).fill('36.5');
  await page.getByLabel('Peso (kg)', { exact: true }).fill('68.125');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Histórico da escuta · 1 registro', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('.intake-history')).toContainText('68,125');
  await page.getByLabel('Temperatura (°C)', { exact: true }).fill('36.8');
  await page.getByRole('button', { name: 'Salvar nova aferição', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Histórico da escuta · 2 registros', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Registrar correção', exact: true }).first().click();
  await page
    .getByLabel('Motivo da correção', { exact: true })
    .fill('Ajuste de digitação no teste.');
  await page.getByLabel('Temperatura (°C)', { exact: true }).fill('36.7');
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.getByText('Substituído por correção', { exact: true })).toBeVisible();
  await expect(page.locator('.intake-history')).toContainText('36,8');
  await expect(page.locator('.intake-history')).toContainText('36,7');
  await page.getByRole('button', { name: 'Iniciar atendimento', exact: true }).click();
  await expect(page.locator('.intake-history')).toContainText(
    'Relato fictício para testar a escuta.',
  );
  await page.getByLabel('A · Avaliação', { exact: true }).fill('Avaliação fictícia para o teste.');
  await page.getByLabel('P · Plano', { exact: true }).fill('Plano fictício de teste.');
  await page.getByRole('button', { name: 'R05 · Tosse', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar e concluir', exact: true }).click();
  await expect(page.getByLabel('A · Avaliação', { exact: true })).toBeDisabled();
  await page.getByLabel('Motivo do complemento', { exact: true }).fill('Informação adicional.');
  await page
    .getByLabel('Texto do complemento', { exact: true })
    .fill('Complemento fictício preservando o texto original.');
  await page.getByRole('button', { name: 'Registrar complemento', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Complemento salvo');
  await page.reload();
  await expect(page.locator('.note-addenda')).toContainText(
    'Complemento fictício preservando o texto original.',
  );
  await expect(page.getByLabel('A · Avaliação', { exact: true })).toHaveValue(
    'Avaliação fictícia para o teste.',
  );
  await page.getByRole('link', { name: 'Abrir histórico da pessoa' }).click();
  await expect(page.locator('.note-addenda')).toContainText('Informação adicional.');
  await expect(page.locator('.intake-history')).toContainText('UBS Centro');
  await selectSession(page, { role: 'reception' });
  await expect(page.locator('.intake-history')).toHaveCount(0);
  await expect(page.locator('.note-addenda')).toHaveCount(0);
  await expect(
    page.getByText('Relato fictício para testar a escuta.', { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('escuta protege rascunho e funciona na UPA em tela pequena', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await selectSession(page, { unitId: 'aurora-upa', role: 'nursing' });
  await page.goto('/escuta/aurora-upa-e0');
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await page
    .getByLabel('Motivo da procura', { exact: true })
    .fill('Texto fictício ainda não salvo.');
  await page.getByRole('link', { name: 'Escuta e sinais vitais', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  await expect(page.getByLabel('Motivo da procura', { exact: true })).toHaveValue(
    'Texto fictício ainda não salvo.',
  );
  await page.getByRole('link', { name: 'Trocar sessão de demonstração' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByLabel('Unidade ativa')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('salvas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Registrar correção', exact: true }).click();
  await page.getByLabel('Motivo da correção').fill('Conferência do teste.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('HTML independente mantém escuta e correções offline', async ({ browser }) => {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href);
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.getByRole('link', { name: 'Escuta e sinais vitais', exact: true }).click();
  await page.getByRole('link', { name: 'Registrar escuta', exact: true }).first().click();
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await page.getByLabel('Motivo da procura', { exact: true }).fill('Teste offline da escuta.');
  await page.getByLabel('Saturação de oxigênio (%)', { exact: true }).fill('98');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('salvas');
  await page.reload();
  await expect(page.locator('.intake-history')).toContainText('Teste offline da escuta.');
  await page.getByRole('button', { name: 'Registrar correção', exact: true }).click();
  await page.getByLabel('Motivo da correção').fill('Conferência offline.');
  await page.getByLabel('Saturação de oxigênio (%)', { exact: true }).fill('97');
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.getByText('Substituído por correção', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.intake-history')).toContainText('Conferência offline.');
  await context.close();
});
