import { demoCpf, formatCpf } from '../src/domain/identification';
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';
import { reviewTicket } from './kiosk-flow';

test('CPF, preferência e motivo chegam à recepção sem dados pessoais no recibo', async ({
  page,
}) => {
  const response = await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Emitir minha senha' })).toHaveCount(0);
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByLabel('CPF', { exact: true }).fill('11111111111');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1988-03-14');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('11 números');
  await page.getByText('Dados fictícios para testar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preencher exemplo fictício' }).click();
  await reviewTicket(page, { identified: true, preference: 'pregnant' });
  await expect(page.locator('.kiosk-review')).toContainText('CPF final 0191');
  await expect(page.getByLabel('CPF', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  const receipt = page.locator('.ticket-receipt');
  await expect(receipt).toContainText('Atendimento preferencial solicitado');
  await expect(receipt).not.toContainText('Ana Clara');
  await expect(receipt).not.toContainText('Gestante');
  await expect(receipt).not.toContainText('000.000.001-91');
  await page.goto('/');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.goto('/recepcao');
  await expect(page.locator('.desk-row').filter({ hasText: 'Ana Clara Martins' })).toContainText(
    'Preferencial · Gestante',
  );
});

test('nome completo identifica; cadastro desconhecido permite balcão e conserva serviço e preferência', async ({
  page,
}) => {
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('  lucas   pereira ');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1962-08-10');
  await reviewTicket(page, { identified: true, service: 'Farmácia' });
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toContainText('Farmácia');
  await expect(page.locator('.ticket-receipt')).toContainText('Aguarde sua senha');
  await page.getByRole('button', { name: 'Próxima pessoa' }).click();
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Nome Não Cadastrado');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1990-01-01');
  await reviewTicket(page, { identified: true, service: 'Farmácia', preference: 'disability' });
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.getByRole('alert')).toContainText('confirmar o cadastro');
  await page.getByRole('button', { name: 'Continuar pela recepção' }).click();
  await expect(page.locator('.kiosk-review')).toContainText('Identificação na recepção');
  await expect(page.locator('.kiosk-review')).not.toContainText('Nome Não Cadastrado');
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toContainText('recepção para identificação');
  await expect(page.locator('.ticket-receipt')).toContainText('Farmácia');
  await expect(page.locator('.ticket-receipt')).toContainText(
    'Atendimento preferencial solicitado',
  );
});

test('etapas preservam escolhas ao voltar e só a confirmação emite a senha', async ({
  page,
  context,
}) => {
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  const reception = await context.newPage();
  await reception.goto('/recepcao');
  await selectSession(reception, { role: 'reception', unitId: 'aurora-centro' });
  const initial = await reception.locator('.desk-row').count();
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByText('Dados fictícios para testar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preencher exemplo fictício' }).click();
  await page.getByLabel('CPF', { exact: true }).fill(demoCpf(12));
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1962-08-10');
  await reviewTicket(page, { identified: true, service: 'Vacinação', preference: 'pregnant' });
  await expect(reception.locator('.desk-row')).toHaveCount(initial);
  await page.getByRole('button', { name: 'Alterar identificação' }).click();
  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue(formatCpf(demoCpf(12)));
  await page.getByRole('button', { name: 'Por nome completo', exact: true }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Lucas Pereira');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1962-08-10');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Vacinação', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Motivo da preferência')).toHaveValue('pregnant');
  await page.getByRole('radio', { name: 'Atendimento comum', exact: true }).check();
  await expect(page.getByLabel('Motivo da preferência')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conferir minha senha' }).click();
  await expect(page.locator('.kiosk-review')).toContainText('Atendimento comum');
  await page.getByRole('button', { name: 'Emitir minha senha' }).click({ clickCount: 2 });
  await expect(page.locator('.ticket-receipt')).toContainText('Vacinação');
  await expect(reception.locator('.desk-row')).toHaveCount(initial + 1);
});

test('tela limpa identificação e preferência após inatividade na conferência', async ({ page }) => {
  await page.clock.install();
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Fictícia');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1990-01-01');
  await reviewTicket(page, { identified: true, preference: 'disability' });
  await page.clock.fastForward(62000);
  await expect(page.getByRole('heading', { name: 'Como podemos cuidar de você?' })).toBeVisible();
  await expect(page.locator('.kiosk-review')).toHaveCount(0);
  await page.getByRole('button', { name: /Usar meu nome/ }).click();
  await expect(page.getByLabel('Nome completo', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Data de nascimento', { exact: true })).toHaveValue('');
  await page
    .getByRole('button', { name: 'Não tenho cadastro ou não consigo me identificar' })
    .click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Atendimento comum', exact: true })).toBeChecked();
});

test('HTML offline percorre as quatro etapas no celular, volta e cancela sem emitir', async ({
  browser,
}) => {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo-Totem.html')).href);
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByRole('button', { name: 'Por nome completo', exact: true }).click();
  await page.getByText('Dados fictícios para testar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preencher exemplo fictício' }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'O que você precisa hoje?' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await page.getByLabel('Motivo da preferência').selectOption('blood-donor');
  await expect(page.getByText(/comprovante de doação dos últimos 120 dias/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Conferir minha senha' }).click();
  await expect(page.locator('.kiosk-progress [aria-current="step"]')).toContainText('Conferência');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByLabel('Motivo da preferência')).toHaveValue('blood-donor');
  await page.getByRole('button', { name: 'Cancelar e recomeçar' }).click();
  await expect(page.getByRole('heading', { name: 'Como podemos cuidar de você?' })).toBeVisible();
  await expect(page.locator('.ticket-receipt')).toHaveCount(0);
  await context.close();
});
