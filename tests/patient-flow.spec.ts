import { reviewTicket } from './kiosk-flow';
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';

test('perfis vinculam unidade, prefeitura filtra a sua rede e administração não edita clínica', async ({
  page,
}) => {
  await page.goto('/');
  await selectSession(page, { role: 'admin', unitId: 'aurora-centro' });
  await expect(page.getByLabel('Unidade ativa')).toHaveCount(0);
  await expect(page.getByLabel('Rede ativa')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Unidades da rede', exact: true })).toHaveCount(0);
  await page.goto('/atendimento/aurora-centro-e0');
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  await page.goto('/unidades');
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  await selectSession(page, { role: 'manager', unitId: 'aurora-centro' });
  await expect(page.getByLabel('Unidade ativa')).toBeVisible();
  const options = await page.getByLabel('Unidade ativa').locator('option').allTextContents();
  expect(options).not.toContain('UBS Jardim');
  await page.getByLabel('Unidade ativa').selectOption('aurora-vila');
  await expect(page.locator('.contextbar')).toContainText('Rede Aurora');
});

test('totem → identificação → chamada da estação → TV → consulta → desempenho', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const kiosk = await context.newPage();
  await kiosk.goto('/totem?rede=aurora&unidade=aurora-centro');
  await kiosk.getByRole('button', { name: /Preciso da recepção/ }).click();
  await reviewTicket(kiosk);
  await kiosk.getByRole('button', { name: 'Emitir minha senha' }).click();
  const ticket = (await kiosk.locator('.ticket-receipt strong').textContent())!;
  expect(await kiosk.locator('.ticket-receipt').textContent()).not.toContain('DEMO-00');
  await kiosk.evaluate(() => {
    window.print = () => document.body.setAttribute('data-print', 'requested');
  });
  await kiosk.getByRole('button', { name: 'Imprimir senha' }).click();
  await expect(kiosk.locator('body')).toHaveAttribute('data-print', 'requested');
  await page.goto('/recepcao');
  await page
    .getByTestId(`desk-${ticket}`)
    .getByRole('button', { name: 'Conferir chegada' })
    .click();
  await page.getByLabel(`Pessoa da senha ${ticket}`, { exact: true }).selectOption('aurora-p12');
  await page.getByLabel('Conferir por', { exact: true }).selectOption('name');
  await page.getByLabel('Nome informado pela pessoa', { exact: true }).fill('Lucas Pereira');
  await page.getByLabel('Nascimento informado pela pessoa', { exact: true }).fill('1962-08-10');
  await page
    .getByRole('checkbox', { name: 'Conferi a identificação com a pessoa ou responsável' })
    .check();
  await page
    .getByRole('checkbox', { name: 'Conferi a preferência de atendimento com a pessoa' })
    .check();
  await page.getByRole('button', { name: 'Conferir e encaminhar' }).click();
  await expect(page.getByRole('status')).toContainText('horário de chegada');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.goto('/consultorio');
  const row = page.locator('.consulting-list>article').filter({ hasText: ticket });
  const tv = await context.newPage();
  await tv.goto('/painel?rede=aurora&unidade=aurora-centro');
  await row.getByRole('button', { name: 'Chamar / rechamar na TV' }).click();
  await expect(tv.getByTestId('current-ticket')).toHaveText(ticket);
  await expect(row).toContainText('Aguardando entrada');
  await row.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
  await page.getByRole('link', { name: 'Continuar registro clínico' }).click();
  await page.getByLabel('A · Avaliação', { exact: true }).fill('Avaliação fictícia.');
  await page.getByLabel('P · Plano', { exact: true }).fill('Plano de teste.');
  await page.getByRole('button', { name: 'Chamar / rechamar na TV' }).click();
  await expect(page.getByRole('status')).toContainText('enviada');
  await page.getByRole('button', { name: 'Salvar e concluir' }).click();
  await expect(page.getByText('Registro concluído', { exact: true })).toBeVisible();
  await page.goto('/desempenho');
  await expect(page.getByRole('row').filter({ hasText: 'Dra. Marina' })).toContainText(
    'UBS Centro',
  );
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro', second: true });
  await expect(
    page.getByRole('heading', { name: 'Ainda não há consultas com autoria registrada' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('família → visita → histórico; empresa possui espaço separado e contratos vinculados', async ({
  page,
}) => {
  await page.goto('/');
  await selectSession(page, { role: 'acs', unitId: 'aurora-centro' });
  await page.goto('/modulos/familias');
  await page.getByRole('button', { name: 'Novo registro' }).click();
  for (const [label, value] of [
    ['Referência da família', 'Família de teste'],
    ['Endereço fictício', 'Rua de teste, 10'],
    ['Microárea', '01'],
    ['Agente responsável', 'Agente de teste'],
    ['Quantidade de moradores', '3'],
    ['Composição familiar e referências de cadastro', 'Três pessoas fictícias.'],
    ['Necessidades de acompanhamento', 'Retorno solicitado.'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('status')).toContainText('salvo');
  await page.goto('/modulos/visitas');
  await page.getByRole('button', { name: 'Novo registro' }).click();
  await page
    .getByLabel('Família / domicílio', { exact: true })
    .selectOption({ label: 'Família de teste' });
  await page.getByLabel('Data planejada', { exact: true }).fill('2026-10-29');
  await page.getByLabel('Agente responsável', { exact: true }).fill('Agente de teste');
  await page.getByLabel('Prioridade de acompanhamento', { exact: true }).selectOption('Rotina');
  await page.getByLabel('Objetivo da visita', { exact: true }).fill('Visita fictícia.');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await page.getByRole('button', { name: 'Visita registrada', exact: true }).click();
  await page
    .getByLabel('Resultado, evidência ou motivo')
    .fill('Visita realizada e retorno combinado.');
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(page.getByRole('status')).toContainText('atualizada');
  await page.reload();
  await page.getByRole('button', { name: 'Detalhes e histórico' }).click();
  await expect(page.getByRole('dialog')).toContainText('Visita realizada e retorno combinado.');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await selectSession(page, { role: 'business' });
  await page.goto('/modulos/bo-municipios');
  await expect(page.getByRole('link', { name: 'Pessoas e prontuários', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Novo registro' }).click();
  for (const [label, value] of [
    ['Cliente / prefeitura', 'Município fictício'],
    ['Município / UF', 'Cidade de Teste / RS'],
    ['Contato comercial fictício', 'Contato de teste'],
    ['Unidades previstas', '100'],
    ['Responsável comercial', 'Equipe Cuidelo'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('status')).toContainText('salvo');
  await page.goto('/paineis/bo-uso');
  await expect(page.getByRole('row').filter({ hasText: 'Município fictício' })).toContainText(
    '100',
  );
  await selectSession(page, { role: 'manager', organizationId: 'aurora', unitId: 'aurora-centro' });
  await page.goto('/modulos/bo-municipios');
  await expect(
    page.getByRole('heading', { name: 'Módulo indisponível nesta sessão' }),
  ).toBeVisible();
});

test('totem independente funciona offline e se ajusta ao celular', async ({ browser }) => {
  const context = await browser.newContext({
      offline: true,
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo-Totem.html')).href);
  await expect(page.getByRole('heading', { name: 'Como podemos cuidar de você?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Preciso da recepção/ }).click();
  await reviewTicket(page);
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt strong')).toHaveText(/^A-/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Próxima pessoa' }).click();
  await expect(page.getByRole('heading', { name: 'Como podemos cuidar de você?' })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
