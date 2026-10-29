import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';
import { demoCpf } from '../src/domain/identification';

async function confirm(page: Page, cpf = demoCpf(12), birth = '1962-08-10') {
  await page.getByLabel('CPF informado pela pessoa', { exact: true }).fill(cpf);
  await page.getByLabel('Nascimento informado pela pessoa', { exact: true }).fill(birth);
  await page
    .getByRole('checkbox', { name: 'Conferi a identificação com a pessoa ou responsável' })
    .check();
  await page
    .getByRole('checkbox', { name: 'Conferi a preferência de atendimento com a pessoa' })
    .check();
}
test('senha anônima → guichê → conferência → triagem → consultório, com TV e tempos', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/recepcao');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const kiosk = await context.newPage();
  await kiosk.goto('/totem?rede=aurora&unidade=aurora-centro');
  await kiosk.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
  await kiosk.getByRole('button', { name: /Preciso da recepção/ }).click();
  await kiosk.getByRole('radio', { name: 'Consulta ou retorno', exact: true }).check();
  await kiosk.getByLabel('Motivo da preferência', { exact: true }).selectOption('pregnant');
  await kiosk.getByRole('button', { name: 'Emitir minha senha' }).click();
  const ticket = (await kiosk.locator('.ticket-receipt strong').textContent())!;
  const row = page.getByTestId(`desk-${ticket}`);
  await expect(row).toBeVisible();
  const tv = await context.newPage();
  await tv.goto('/painel?rede=aurora&unidade=aurora-centro');
  await row.getByRole('button', { name: 'Chamar no guichê' }).click();
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket);
  await expect(tv.locator('.tv-room')).toContainText('Guichê 01');
  await row.getByRole('button', { name: 'Conferir chegada' }).click();
  await page.getByLabel(`Pessoa da senha ${ticket}`, { exact: true }).selectOption('aurora-p12');
  await confirm(page, demoCpf(12), '2000-01-01');
  await page.getByRole('button', { name: 'Conferir e encaminhar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('nascimento');
  await confirm(page);
  await page.getByRole('button', { name: 'Conferir e encaminhar', exact: true }).click();
  await expect(row).toContainText('Aguardando triagem');
  await expect(row).toContainText('Gestante · conferido');
  await row.getByRole('button', { name: 'Chamar para triagem', exact: true }).click();
  await expect(tv.locator('.tv-room')).toContainText('Sala 01');
  await expect(tv.locator('.tv-canvas')).not.toContainText('Lucas');
  await expect(tv.locator('.tv-canvas')).not.toContainText('Gestante');
  await row.getByRole('button', { name: 'Ver percurso' }).click();
  await expect(page.locator('.desk-timeline')).toContainText('Guichê 01');
  await page.getByRole('button', { name: 'Fechar percurso' }).click();
  await selectSession(page, { role: 'clinical' });
  await page.goto('/consultorio');
  await expect(page.locator('.consulting-list>article').filter({ hasText: ticket })).toHaveCount(0);
  await selectSession(page, { role: 'nursing' });
  await page.goto('/escuta');
  await page
    .getByRole('row')
    .filter({ hasText: ticket })
    .getByRole('link', { name: 'Registrar escuta' })
    .click();
  await page.getByRole('button', { name: 'Chamar / rechamar para triagem' }).click();
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await page.getByLabel('Motivo da procura', { exact: true }).fill('Relato fictício da triagem.');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Histórico da escuta · 1 registro' }),
  ).toBeVisible();
  await selectSession(page, { role: 'clinical' });
  await page.goto('/consultorio');
  const clinicalRow = page.locator('.consulting-list>article').filter({ hasText: ticket });
  await clinicalRow.getByRole('button', { name: 'Chamar / rechamar na TV' }).click();
  await expect(tv.locator('.tv-room')).toContainText('Consultório 01');
  await clinicalRow.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
  await selectSession(page, { role: 'admin' });
  await page.goto('/desempenho');
  await expect(
    page.getByRole('heading', { name: 'Conferência por profissional da recepção' }),
  ).toBeVisible();
  await expect(page.getByText('Conferência na recepção', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('ausência, retorno e cadastro sem CPF preservam a senha e permitem encaminhamento direto', async ({
  page,
}) => {
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Preciso da recepção/ }).click();
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  const ticket = (await page.locator('.ticket-receipt strong').textContent())!;
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.goto('/recepcao');
  const row = page.getByTestId(`desk-${ticket}`);
  await row.getByRole('button', { name: 'Chamar no guichê' }).click();
  await row.getByRole('button', { name: 'Registrar ausência' }).click();
  await page.getByLabel('Motivo da ausência').fill('Pessoa não localizada após a chamada.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Registrar ausência', exact: true })
    .click();
  await expect(row).toContainText('Ausente na chamada');
  await expect(row.getByRole('button', { name: 'Chamar no guichê' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Registrar retorno' }).click();
  await row.getByRole('button', { name: 'Conferir chegada' }).click();
  await page.getByRole('button', { name: 'Cadastrar nova pessoa', exact: true }).click();
  const register = page.getByRole('dialog', { name: 'Novo cadastro da recepção' });
  await register.getByLabel('Nome completo', { exact: true }).fill('Pessoa Fictícia do Balcão');
  await register.getByLabel('Nascimento do novo cadastro', { exact: true }).fill('1994-05-06');
  await register.getByRole('button', { name: 'Cadastrar e selecionar' }).click();
  await page
    .getByLabel('Nome informado pela pessoa', { exact: true })
    .fill('Pessoa Fictícia do Balcão');
  await page.getByLabel('Nascimento informado pela pessoa', { exact: true }).fill('1994-05-06');
  await page
    .getByRole('checkbox', { name: 'Conferi a identificação com a pessoa ou responsável' })
    .check();
  await page
    .getByRole('checkbox', { name: 'Conferi a preferência de atendimento com a pessoa' })
    .check();
  await page.getByRole('button', { name: 'Conferir e encaminhar' }).click();
  await expect(row).toContainText('Pessoa Fictícia do Balcão');
  await expect(row).toContainText('Aguardando atendimento');
  await row.getByRole('button', { name: 'Ver percurso' }).click();
  await expect(page.locator('.desk-timeline')).toContainText('Ausência registrada');
  await expect(page.locator('.desk-timeline')).toContainText('Retorno registrado');
  await page.getByRole('button', { name: 'Fechar percurso' }).click();
  await page.reload();
  await expect(row).toContainText('Pessoa Fictícia do Balcão');
});
test('recepção do HTML funciona offline no celular, confere CPF e abre a TV do mesmo arquivo', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href;
  await page.goto(base + '#/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByText('Dados fictícios para testar', { exact: true }).click();
  await page.getByRole('button', { name: 'Preencher exemplo fictício' }).click();
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  const ticket = (await page.locator('.ticket-receipt strong').textContent())!;
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.goto(base + '#/recepcao');
  const row = page.getByTestId(`desk-${ticket}`);
  await row.getByRole('button', { name: 'Conferir chegada' }).click();
  await confirm(page, demoCpf(1), '1988-03-14');
  await page.getByRole('button', { name: 'Conferir e encaminhar' }).click();
  await expect(row).toContainText('Aguardando triagem');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Abrir TV conectada' }).click();
  const tv = await popup;
  expect(tv.url().split('#')[0]).toBe(base);
  await row.getByRole('button', { name: 'Chamar para triagem' }).click();
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket);
  await expect(tv.locator('.tv-room')).toContainText('Sala 01');
});
