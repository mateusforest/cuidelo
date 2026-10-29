import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';

test('CPF, preferência e motivo chegam à recepção sem dados pessoais no recibo', async ({
  page,
}) => {
  const response = await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  expect(response?.status()).toBe(200);
  await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByLabel('CPF', { exact: true }).fill('11111111111');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1988-03-14');
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.getByRole('alert')).toContainText('11 números');
  await page.getByText('Dados fictícios para testar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preencher exemplo fictício' }).click();
  await page.getByLabel('Motivo da preferência', { exact: true }).selectOption('pregnant');
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  const receipt = page.locator('.ticket-receipt');
  await expect(receipt).toContainText('Atendimento preferencial solicitado');
  await expect(receipt).not.toContainText('Ana Clara');
  await expect(receipt).not.toContainText('Gestante');
  await expect(receipt).not.toContainText('000.000.001-91');
  await page.goto('/');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.goto('/recepcao');
  await expect(page.getByRole('row').filter({ hasText: 'Ana Clara Martins' })).toContainText(
    'Preferencial: Gestante',
  );
});

test('nome completo identifica, senha mantém serviço e cadastro não encontrado oferece balcão', async ({
  page,
}) => {
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('  lucas   pereira ');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1962-08-10');
  await page.getByRole('radio', { name: 'Farmácia', exact: true }).check();
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toContainText('Farmácia');
  await expect(page.locator('.ticket-receipt')).toContainText('Aguarde sua senha');
  await page.getByRole('button', { name: 'Próxima pessoa' }).click();
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Nome Não Cadastrado');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1990-01-01');
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.getByRole('alert')).toContainText('confirmar o cadastro');
  await page.getByRole('button', { name: 'Continuar pela recepção' }).click();
  await expect(page.getByLabel('Nome completo', { exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toContainText('recepção para identificação');
  await expect(page.locator('.ticket-receipt')).toContainText(
    'Atendimento preferencial solicitado',
  );
});

test('tela limpa identificação e preferência após inatividade', async ({ page }) => {
  await page.clock.install();
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Fictícia');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1990-01-01');
  await page.getByLabel('Motivo da preferência').selectOption('disability');
  await page.clock.fastForward(62000);
  await expect(page.getByRole('heading', { name: 'Como podemos cuidar de você?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Atendimento comum', exact: true })).toBeChecked();
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await expect(page.getByLabel('Nome completo', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Data de nascimento', { exact: true })).toHaveValue('');
});

test('HTML offline oferece CPF, nome e preferência sem rolagem lateral no celular', async ({
  browser,
}) => {
  const context = await browser.newContext({
      offline: true,
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo-Totem.html')).href);
  await expect(
    page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await page.getByLabel('Motivo da preferência').selectOption('blood-donor');
  await expect(page.getByText(/comprovante de doação dos últimos 120 dias/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Por nome completo', exact: true }).click();
  await expect(page.getByLabel('Nome completo', { exact: true })).toBeVisible();
  await context.close();
});
