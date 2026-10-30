import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';
import { demoCpf } from '../src/domain/identification';

test('agenda remarca com conflito, mantém histórico e confirma a chegada no novo horário', async ({
  page,
}) => {
  await page.goto('/agenda');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const row = page.locator('.appointment-row').filter({ hasText: 'Beatriz Fernandes' });
  await row.getByRole('button', { name: /Remarcar agendamento/ }).click();
  await page.getByLabel('Horário', { exact: true }).fill('11:00');
  await page.getByLabel('Motivo da remarcação').fill('Ajuste fictício solicitado pela pessoa.');
  await page.getByRole('button', { name: 'Confirmar remarcação' }).click();
  await expect(page.getByRole('alert')).toContainText('profissional já tem');
  await page.getByLabel('Horário', { exact: true }).fill('18:00');
  await page.getByRole('button', { name: 'Confirmar remarcação' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row.locator('.appointment-time')).toContainText('18:00');
  await row.getByText('Histórico de remarcações (1)', { exact: true }).click();
  await expect(row.locator('.appointment-history')).toContainText('09:00');
  await expect(row.locator('.appointment-history')).toContainText('Ajuste fictício solicitado');
  await page.reload();
  await expect(row.locator('.appointment-time')).toContainText('18:00');
  await row.getByRole('button', { name: /Confirmar chegada/ }).click();
  await expect(row).toContainText('Chegada confirmada');
  await expect(row.getByRole('button', { name: /Remarcar agendamento/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Chegadas confirmadas/ }).click();
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Ver recepção' }).click();
  await expect(page.locator('.desk-row').filter({ hasText: 'Beatriz Fernandes' })).toBeVisible();
});

test('cadastro atualiza com motivo, bloqueia CPF repetido e preserva antes/depois', async ({
  page,
}) => {
  await page.goto('/pessoas/aurora-p1');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Atualizar cadastro', exact: true }).click();
  await page.getByLabel('CPF (opcional)', { exact: true }).fill(demoCpf(2));
  await page.getByLabel('Nome completo', { exact: true }).fill('Ana Clara Cadastro Fictício');
  await page.getByLabel('Telefone (opcional)', { exact: true }).fill('Contato fictício novo');
  await page.getByLabel('Motivo da atualização').fill('Conferência de dados de teste no balcão.');
  await page.getByRole('button', { name: 'Salvar atualização' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe');
  await page.getByLabel('CPF (opcional)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Salvar atualização' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Ana Clara Cadastro Fictício', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.registration-history')).toContainText('Antes: Ana Clara Martins');
  await expect(page.locator('.registration-history')).toContainText(
    'Depois: Ana Clara Cadastro Fictício',
  );
  await page.reload();
  await expect(page.locator('.registration-history')).toContainText('Conferência de dados');
  await page.goto('/pessoas');
  await page.getByRole('button', { name: /Sem CPF informado/ }).click();
  await expect(
    page.getByRole('link', { name: /Ana Clara Cadastro Fictício Registro fictício/ }),
  ).toBeVisible();
  await selectSession(page, { role: 'clinical' });
  await page.goto('/pessoas/aurora-p1');
  await expect(page.getByRole('button', { name: 'Atualizar cadastro' })).toHaveCount(0);
  await selectSession(page, { role: 'reception', organizationId: 'horizonte' });
  await page.goto('/pessoas/aurora-p1');
  await expect(
    page.getByRole('heading', { name: 'Cadastro não encontrado nesta rede' }),
  ).toBeVisible();
});

test('duas janelas não sobrescrevem atualização cadastral já salva', async ({ page, context }) => {
  await page.goto('/pessoas/aurora-p1');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const second = await context.newPage();
  await second.goto('/pessoas/aurora-p1');
  for (const tab of [page, second]) {
    await tab.getByRole('button', { name: 'Atualizar cadastro' }).click();
    await tab.getByLabel('Motivo da atualização').fill('Teste de duas conferências.');
  }
  await page.getByLabel('Telefone (opcional)').fill('Primeiro contato fictício');
  await page.getByRole('button', { name: 'Salvar atualização' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.getByLabel('Telefone (opcional)').fill('Segundo contato fictício');
  await second.getByRole('button', { name: 'Salvar atualização' }).click();
  await expect(second.getByRole('alert')).toContainText(/atualizado|mudaram/);
  await second.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await second.reload();
  await expect(second.locator('.registration-history')).toContainText('Primeiro contato fictício');
  await expect(second.locator('.registration-history')).not.toContainText(
    'Segundo contato fictício',
  );
});

test('triagem separa a espera da escuta em andamento e mantém as aferições na fila concluída', async ({
  page,
}) => {
  await page.goto('/escuta');
  await selectSession(page, { role: 'nursing', unitId: 'aurora-centro' });
  const row = page.getByRole('row').filter({ hasText: 'Ana Clara Martins' });
  await expect(row.locator('.intake-time')).toContainText('aguardando escuta');
  await row.getByRole('link', { name: 'Registrar escuta' }).click();
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await expect(page.getByLabel('Tempos desta escuta')).toContainText('Tempo em escuta');
  await page.getByRole('link', { name: 'Voltar à fila de escuta' }).click();
  await page.getByRole('button', { name: /^Em escuta/ }).click();
  await expect(row.locator('.intake-time')).toContainText('em escuta');
  await row.getByRole('link', { name: 'Continuar escuta' }).click();
  await page.getByLabel('Motivo da procura', { exact: true }).fill('Relato fictício da nova fila.');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(page.getByLabel('Tempos desta escuta')).toContainText('Duração da escuta inicial');
  await page.getByRole('link', { name: 'Voltar à fila de escuta' }).click();
  await page.getByRole('button', { name: /Com escuta registrada/ }).click();
  await row.getByRole('link', { name: 'Abrir histórico' }).click();
  await expect(page.locator('.intake-history')).toContainText('Relato fictício da nova fila.');
});

test('HTML offline no celular permite atualização e remarcação sem rolagem lateral da página', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#';
  await page.goto(base + '/pessoas/aurora-p1');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Atualizar cadastro' }).click();
  await page.getByLabel('Telefone (opcional)').fill('Contato fictício offline');
  await page.getByLabel('Motivo da atualização').fill('Teste no HTML portátil.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Salvar atualização' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base + '/agenda');
  await page
    .locator('.appointment-row')
    .filter({ hasText: 'Beatriz Fernandes' })
    .getByRole('button', { name: /Remarcar/ })
    .click();
  await page.getByLabel('Horário', { exact: true }).fill('18:00');
  await page.getByLabel('Motivo da remarcação').fill('Teste de remarcação offline.');
  await page.getByRole('button', { name: 'Confirmar remarcação' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('.appointment-row').filter({ hasText: 'Beatriz Fernandes' }),
  ).toContainText('18:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '/pessoas/aurora-p1');
  await expect(page.locator('.registration-history')).toContainText('Contato fictício offline');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
