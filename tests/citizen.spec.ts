import { test, expect } from '@playwright/test';
import { selectSession } from './session';
const origin = process.env.CUIDELO_CITIZEN_TEST_ORIGIN || 'http://127.0.0.1:43173';

test('no celular o cidadão consulta sua agenda e os três documentos sem abrir uma sessão da equipe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(origin + '/cidadao');
  await expect(page.getByRole('heading', { name: 'Sua saúde no Cuidelo' })).toBeVisible();
  await page.getByRole('button', { name: /Ana Clara Martins/ }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.database.v1'))).toBeNull();
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page.locator('.cit-appt')).toHaveCount(2);
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.locator('.cit-appt')).toContainText('Cancelado');
  await page.getByRole('link', { name: 'Documentos', exact: true }).click();
  for (const [filter, kind, content] of [
    ['Receitas', 'Receita', 'Medicamento demonstrativo A'],
    ['Exames', 'Pedido de exames', 'Exame laboratorial demonstrativo'],
    ['Atestados', 'Atestado', '2 dia(s)'],
  ]) {
    await page.getByRole('button', { name: filter, exact: true }).click();
    await expect(page.locator('.cit-doc-card')).toHaveCount(1);
    await page.locator('.cit-doc-card').click();
    await expect(page.getByRole('heading', { name: kind, exact: true })).toBeVisible();
    await expect(page.locator('.cit-sheet')).toContainText(content);
    await page.reload();
    await expect(page.locator('.cit-sheet')).toContainText(content);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Meus documentos', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Sair do app do cidadão' }).click();
  await page.getByRole('button', { name: /João Pedro Souza/ }).click();
  await page.getByRole('link', { name: 'Documentos', exact: true }).click();
  await expect(page.locator('.cit-empty')).toContainText('Nenhum documento');
  await page.goto(origin + '/cidadao/documentos/id-fora-do-escopo');
  await expect(page.getByRole('heading', { name: 'Documento indisponível' })).toBeVisible();
});
test('a unidade disponibiliza uma cópia cifrada e o celular recebe e retira o atestado conforme o consultório', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    }),
    mobile = await phone.newPage();
  const patient = origin + '/pessoas/aurora-p1';
  let created = false;
  try {
    await page.goto(origin + '/agenda');
    await selectSession(page, { role: 'admin', unitId: 'aurora-centro' });
    await page.getByRole('button', { name: 'Novo agendamento' }).click();
    await page.locator('select[name="patient"]').selectOption('aurora-p1');
    await page.getByLabel('Data', { exact: true }).fill('2099-10-31');
    await page.getByLabel('Horário', { exact: true }).fill('14:10');
    await page.getByRole('button', { name: 'Agendar atendimento' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto(patient);
    await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
    await page.getByRole('button', { name: 'Disponibilizar no celular' }).click();
    const wire = page.waitForRequest(
      (req) => req.url().endsWith('/api/cidadao') && req.postDataJSON()?.op === 'create',
    );
    await page.getByRole('button', { name: 'Gerar link de demonstração' }).click();
    expect((await wire).postData()).not.toMatch(/Martins|2099-10-31|aurora-p1|certificate/);
    const field = page.getByLabel('Link de leitura para o celular');
    await expect(field).toBeVisible({ timeout: 20000 });
    created = true;
    await mobile.goto(await field.inputValue());
    await expect(mobile.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible({ timeout: 15000 });
    await expect(mobile.locator('.cit-next')).toContainText('14:10');
    await expect(mobile).toHaveURL(origin + '/cidadao');
    await mobile.getByRole('link', { name: 'Documentos', exact: true }).click();
    await expect(mobile.locator('.cit-empty')).toBeVisible();
    await page.goto(origin + '/atendimento/aurora-centro-e0');
    await page.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
    await page.getByRole('button', { name: 'Emitir atestado', exact: true }).click();
    await page.getByLabel('Data de início do afastamento').fill('2026-10-31');
    await page.getByLabel('Dias de afastamento').fill('2');
    await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
    await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
    await page.getByRole('button', { name: 'Emitir demonstração' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(mobile.locator('.cit-doc-card')).toContainText('Atestado', { timeout: 30000 });
    await mobile.locator('.cit-doc-card').click();
    await expect(mobile.locator('.cit-sheet')).toContainText('2 dia(s)');
    await page.getByRole('button', { name: 'Cancelar documento', exact: true }).click();
    await page.getByLabel('Justificativa', { exact: true }).fill('Teste de cancelamento');
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
    await expect(mobile.locator('.cit-sheet')).toContainText('Documento cancelado', {
      timeout: 30000,
    });
    await expect(mobile.getByRole('button', { name: 'Imprimir ou salvar PDF' })).toHaveCount(0);
    await page.goto(patient);
    await page.getByRole('button', { name: 'Encerrar link' }).click();
    await expect(page.getByRole('button', { name: 'Gerar link de demonstração' })).toBeVisible();
    created = false;
    await mobile.reload();
    await expect(mobile.getByRole('heading', { name: 'Acesso indisponível' })).toBeVisible();
    await expect(mobile.locator('body')).not.toContainText('Ana Clara');
  } finally {
    if (created) {
      await page.goto(patient);
      const stop = page.getByRole('button', { name: 'Encerrar link' });
      if (await stop.isVisible()) await stop.click();
    }
    await phone.close();
  }
});
