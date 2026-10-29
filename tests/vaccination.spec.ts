import { selectSession } from './session';
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { dateKey, addDays } from '../src/domain/dates';

async function fillApplication(page: Page, lotId = 'aurora-centro-vac0') {
  await page.getByLabel('Lote para aplicação', { exact: true }).selectOption(lotId);
  await page.getByLabel('Via de administração', { exact: true }).selectOption('Intramuscular');
  await page.getByLabel('Local de aplicação', { exact: true }).fill('Local informado no teste');
  await page.getByLabel('Estratégia registrada', { exact: true }).selectOption('Rotina');
  await page.getByLabel('Grupo de atendimento', { exact: true }).fill('Grupo fictício');
  await page
    .getByLabel('Vacinador informado (fictício)', { exact: true })
    .fill('Profissional de teste');
}
test('aprazamento → aplicação → estoque → prontuário → gestão sem nomes de pacientes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.getByRole('link', { name: 'Sala de vacinação', exact: true }).click();
  await page.getByRole('button', { name: 'Aprazar retorno', exact: true }).click();
  await page
    .getByLabel('Imunobiológico do retorno', { exact: true })
    .fill('Imunizante demonstração A');
  await page.getByLabel('Dose prevista', { exact: true }).fill('Dose de teste');
  await page.getByLabel('Data do retorno', { exact: true }).fill(dateKey());
  await page
    .getByLabel('Orientação para o retorno', { exact: true })
    .fill('Retorno informado no teste.');
  await page.getByRole('button', { name: 'Salvar aprazamento', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Retorno registrado');
  await page.getByRole('button', { name: 'Aprazamentos da unidade' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Ana Clara Martins' });
  await row.getByRole('button', { name: 'Registrar aplicação', exact: true }).click();
  await fillApplication(page);
  await expect(page.getByLabel('Dose registrada', { exact: true })).toHaveValue('Dose de teste');
  await page.getByRole('button', { name: 'Salvar aplicação e baixar 1 dose', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('uma dose baixada');
  await page.getByLabel('Exibir aprazamentos').selectOption('all');
  await expect(row).toContainText('Atendido');
  await page.getByRole('link', { name: 'Lotes e estoque', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'VAC-DEMO-01' }).first()).toContainText(
    '19 doses',
  );
  await page.goto('/pessoas/aurora-p1');
  await expect(page.locator('.vaccine-history')).toContainText('Profissional de teste');
  await selectSession(page, { role: 'manager' });
  await page.goto('/vacinacao-rede');
  await expect(page.getByRole('row').filter({ hasText: 'UBS Centro' })).toContainText('1');
  await expect(page.getByText('Ana Clara Martins', { exact: true })).toHaveCount(0);
  await selectSession(page, { role: 'pharmacy' });
  await page.goto('/vacinas-estoque');
  await expect(
    page.getByRole('heading', { name: 'Lotes de imunobiológicos', exact: true }),
  ).toBeVisible();
  await page.goto('/vacinacao');
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('anulação preserva caderneta, persiste e não estorna estoque', async ({ page }) => {
  await page.goto('/');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.goto('/vacinacao');
  await page.getByRole('button', { name: 'Registrar aplicação', exact: true }).click();
  await fillApplication(page);
  await page.getByLabel('Dose registrada', { exact: true }).fill('Dose A');
  await page.getByRole('button', { name: 'Salvar aplicação e baixar 1 dose', exact: true }).click();
  await expect(page.locator('.vaccine-history')).toContainText('Dose A');
  await page.getByRole('button', { name: 'Anular registro', exact: true }).click();
  await page.getByLabel('Motivo da anulação').fill('Erro fictício de identificação.');
  await page.getByRole('button', { name: 'Confirmar anulação', exact: true }).click();
  await expect(page.locator('.vaccine-record')).toContainText('Anulado');
  await page.reload();
  await expect(page.locator('.vaccine-record')).toContainText('Erro fictício de identificação.');
  await page.getByRole('button', { name: 'Transcrever caderneta', exact: true }).click();
  await page
    .getByLabel('Imunobiológico informado', { exact: true })
    .fill('Imunizante do comprovante');
  await page.getByLabel('Origem do comprovante', { exact: true }).fill('Caderneta fictícia');
  await page.getByLabel('Dose registrada', { exact: true }).fill('Dose do comprovante');
  await page.getByLabel('Data da aplicação', { exact: true }).fill(addDays(dateKey(), -10));
  await page.getByRole('button', { name: 'Salvar transcrição', exact: true }).click();
  await expect(page.locator('.vaccine-history')).toContainText('Histórico transcrito');
  await page.getByRole('link', { name: 'Lotes e estoque', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'VAC-DEMO-01' }).first()).toContainText(
    '19 doses',
  );
  await selectSession(page, { organizationId: 'horizonte' });
  await selectSession(page, { unitId: 'horizonte-centro', role: 'nursing' });
  await page.goto('/vacinacao');
  await expect(page.locator('.vaccine-record')).toHaveCount(0);
});

test('lote novo, recebimento, perda e quarentena persistem e bloqueiam aplicação', async ({
  page,
}) => {
  await page.goto('/');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.goto('/vacinas-estoque');
  await page.getByRole('button', { name: 'Cadastrar lote', exact: true }).click();
  await page.getByLabel('Imunobiológico', { exact: true }).fill('Imunizante Teste Novo');
  await page.getByLabel('Fabricante', { exact: true }).fill('Fabricante de teste');
  await page.getByLabel('Número do lote').fill('NOVO-001');
  await page.getByLabel('Validade do lote').fill(addDays(dateKey(), 100));
  await page.getByLabel('Quantidade recebida (doses)').fill('10');
  await page.getByRole('button', { name: 'Cadastrar lote e recebimento', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Imunizante Teste Novo' });
  await expect(row).toContainText('10 doses');
  for (const [kind, count, reason, expected] of [
    ['receipt', '5', 'Recebimento de teste', '15 doses'],
    ['loss', '2', 'Perda de teste', '13 doses'],
    ['quarantine', '', 'Conservação em avaliação', 'Quarentena'],
  ]) {
    await row.getByRole('button', { name: 'Movimentar lote' }).click();
    await page.getByLabel('Tipo de movimentação').selectOption(kind);
    if (count) await page.getByLabel('Quantidade de doses').fill(count);
    await page.getByLabel('Justificativa da movimentação').fill(reason);
    await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();
    await expect(row).toContainText(expected);
  }
  await page.reload();
  await expect(row).toContainText('13 doses');
  await expect(row).toContainText('Quarentena');
  await page.goto('/vacinacao');
  await page.getByRole('button', { name: 'Registrar aplicação', exact: true }).click();
  await expect(
    page.locator('select[name="lotId"] option').filter({ hasText: 'NOVO-001' }),
  ).toBeDisabled();
});

test('HTML offline no celular protege formulário e mantém a caderneta', async ({ browser }) => {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href);
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sala de vacinação', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Transcrever caderneta', exact: true }).click();
  await page.getByLabel('Imunobiológico informado', { exact: true }).fill('Teste offline vacina');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Imunobiológico informado', { exact: true })).toHaveValue(
    'Teste offline vacina',
  );
  await page
    .getByLabel('Origem do comprovante', { exact: true })
    .fill('Documento fictício offline');
  await page.getByLabel('Dose registrada', { exact: true }).fill('Dose informada');
  await page.getByRole('button', { name: 'Salvar transcrição', exact: true }).click();
  await expect(page.locator('.vaccine-history')).toContainText('Teste offline vacina');
  await page.reload();
  await expect(page.locator('.vaccine-history')).toContainText('Documento fictício offline');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
