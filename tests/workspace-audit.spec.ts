import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectSession } from './session';

test('recepção registra e corrige uma falta preservando as duas ações ao recarregar', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
  await page.goto('/agenda');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const row = page.locator('.appointment-row').filter({ hasText: '09:00' }).first();
  await row.getByRole('button', { name: 'Registrar falta' }).click();
  await page.getByLabel('Motivo do registro').fill('Conferido no balcão.');
  await page.getByRole('button', { name: 'Confirmar falta' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Faltas 1/ }).click();
  await expect(row).toContainText('Falta registrada');
  await row.getByRole('button', { name: 'Corrigir falta' }).click();
  await page.getByLabel('Motivo do registro').fill('Correção de demonstração.');
  await page.getByRole('button', { name: 'Confirmar correção' }).click();
  await page.getByRole('button', { name: /Agendamentos do dia/ }).click();
  await row.getByText('Histórico de faltas (2)').click();
  await expect(row).toContainText('Conferido no balcão.');
  await expect(row).toContainText('Correção de demonstração.');
  await expect(row.getByRole('button', { name: /Confirmar chegada/ })).toBeEnabled();
});

test('menu móvel devolve foco e catálogo e mapa respeitam a farmácia', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/modulos');
  await selectSession(page, { role: 'pharmacy', unitId: 'aurora-centro' });
  const toggle = page.getByRole('button', { name: 'Abrir menu' });
  await toggle.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  const search = page.getByRole('searchbox', { name: 'Buscar módulo ou atividade' });
  await search.fill('farmacia');
  await expect(page.locator('main a[href="/farmacia"]')).toBeVisible();
  await search.fill('não existe');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('main a[href="/consultorio"]')).toHaveCount(0);
  await page.goto('/comparacao');
  await expect(page.locator('main a[href="/consultorio"]')).toHaveCount(0);
  await expect(page.locator('main a[href="/farmacia"]').first()).toBeVisible();
});

test('diagnóstico diferencia dependências e permite repetir depois de uma falha', async ({
  page,
}) => {
  await page.goto('/integracoes');
  await selectSession(page, { role: 'admin', unitId: 'aurora-centro' });
  const verify = page.getByRole('button', { name: 'Verificar conexões' }),
    rows = page.locator('.connection-row');
  await expect(rows.getByText('A verificar', { exact: true })).toHaveCount(5);
  await page.route('**/api/cidadao', (r) =>
    r.fulfill({ json: { service: 'citizen', sharing: true, inbox: false } }),
  );
  await verify.click();
  await expect(rows.filter({ hasText: 'Caixa de orientações' })).toContainText('Indisponível');
  await expect(rows.getByText('Disponível', { exact: true })).toHaveCount(4);
  await page.unroute('**/api/cidadao');
  await verify.click();
  await expect(rows.getByText('Disponível', { exact: true })).toHaveCount(5);
  await expect(page.getByText('Não conectado', { exact: true })).toHaveCount(8);
});

test('exportação da prefeitura inclui apenas as unidades do filtro', async ({ page }) => {
  await page.goto('/');
  await selectSession(page, { role: 'manager', organizationId: 'aurora', unitId: 'all' });
  await page.getByRole('button', { name: 'Hospital', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar resumo' }).click();
  const content = await readFile((await (await download).path())!, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('Hospital');
});
