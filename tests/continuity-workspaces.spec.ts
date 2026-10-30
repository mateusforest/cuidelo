import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { demoCpf, formatCpf } from '../src/domain/identification';
import { dateKey, addDays } from '../src/domain/dates';
import { selectSession } from './session';

async function createRecall(page: Page) {
  await page.getByRole('button', { name: 'Aprazar retorno', exact: true }).click();
  await page
    .getByLabel('Imunobiológico do retorno', { exact: true })
    .fill('Imunizante fictício acompanhamento');
  await page.getByLabel('Dose prevista', { exact: true }).fill('Dose fictícia');
  await page.getByLabel('Data do retorno', { exact: true }).fill(dateKey());
  await page
    .getByLabel('Orientação para o retorno', { exact: true })
    .fill('Retorno para teste de contato.');
  await page.getByRole('button', { name: 'Salvar aprazamento', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Retorno registrado');
  await page.getByRole('button', { name: /Previstos hoje/ }).click();
}
async function contactRecall(page: Page) {
  const row = page.getByRole('row').filter({ hasText: 'Imunizante fictício acompanhamento' });
  await row.getByRole('button', { name: 'Registrar contato', exact: true }).click();
  await page.getByLabel('Resultado do contato').selectOption('unanswered');
  await page
    .getByLabel('Registro do contato', { exact: true })
    .fill('Tentativa fictícia sem resposta.');
  await page.getByRole('button', { name: 'Salvar contato', exact: true }).click();
  await expect(row).toContainText('Contatos registrados (1)');
  await row.getByText('Contatos registrados (1)', { exact: true }).click();
  await expect(row).toContainText('Tentativa fictícia sem resposta.');
  await expect(row.locator('.badge')).toHaveText('Pendente');
}
async function createReferral(page: Page) {
  await page.getByRole('button', { name: 'Novo encaminhamento' }).click();
  await page.getByLabel('Pessoa', { exact: true }).selectOption('aurora-p5');
  await page.getByLabel('Especialidade', { exact: true }).selectOption('Neurologia');
  await page.getByLabel('Serviço de destino').fill('Serviço fictício original');
  await page.getByLabel('Justificativa', { exact: true }).fill('Solicitação fictícia preservada.');
  await page.getByRole('button', { name: 'Criar solicitação' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Beatriz Fernandes' });
  await row.getByRole('button', { name: 'Agendar', exact: true }).click();
  await page.getByLabel('Data', { exact: true }).fill(dateKey());
  await page.getByRole('button', { name: 'Registrar agendamento', exact: true }).click();
  await expect(row.locator('.badge')).toHaveText('Agendado');
  return row;
}
test('vacinação registra contato manual, mantém retorno e filtra por hoje e busca', async ({
  page,
}) => {
  await page.goto('/vacinacao');
  await selectSession(page, { role: 'nursing', unitId: 'aurora-centro' });
  await page.getByPlaceholder('Nome, CPF ou cadastro').fill(formatCpf(demoCpf(1)));
  await expect(page.locator('.vaccine-people button')).toHaveCount(1);
  await expect(page.locator('.vaccine-people button')).toContainText('Ana Clara Martins');
  await createRecall(page);
  await contactRecall(page);
  await page.reload();
  await page.getByRole('button', { name: 'Aprazamentos da unidade' }).click();
  await page
    .getByPlaceholder('Buscar pessoa ou vacina nos retornos')
    .fill('imunizante ficticio acompanhamento');
  await expect(page.getByRole('row').filter({ hasText: 'Ana Clara Martins' })).toContainText(
    'Contatos registrados (1)',
  );
  await page.getByRole('button', { name: /Em atraso/ }).click();
  await expect(page.getByText('Nenhum retorno neste filtro')).toBeVisible();
});
test('regulação reagenda, conserva antes/depois e permite registrar retorno no novo horário', async ({
  page,
}) => {
  await page.goto('/regulacao');
  await selectSession(page, { role: 'regulation', unitId: 'aurora-centro' });
  const row = await createReferral(page);
  await row.getByRole('button', { name: 'Reagendar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('09:00');
  await page.getByLabel('Horário', { exact: true }).fill('15:00');
  await page.getByLabel('Destino confirmado').fill('Serviço fictício reagendado');
  await page
    .getByLabel('Motivo do reagendamento', { exact: true })
    .fill('Mudança fictícia informada pelo serviço.');
  await page.getByRole('button', { name: 'Salvar reagendamento' }).click();
  await expect(row).toContainText('15:00');
  await page.reload();
  await row.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Antes:');
  await expect(page.getByRole('dialog')).toContainText('09:00');
  await expect(page.getByRole('dialog')).toContainText('Depois:');
  await expect(page.getByRole('dialog')).toContainText('Mudança fictícia informada');
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await row.getByRole('button', { name: 'Registrar retorno', exact: true }).click();
  await page.getByLabel('Resumo da contrarreferência').fill('Retorno fictício registrado.');
  await page.getByRole('button', { name: 'Concluir com contrarreferência' }).click();
  await page.getByRole('button', { name: /Com retorno registrado/ }).click();
  await expect(row.locator('.badge')).toHaveText('Concluído com retorno');
  await expect(row.getByRole('button', { name: 'Reagendar', exact: true })).toHaveCount(0);
});
test('exame reagenda com motivo e histórico; data ultrapassada e cancelamento filtram corretamente', async ({
  page,
}) => {
  await page.goto('/atendimento/aurora-centro-e0');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Pessoa entrou · iniciar', exact: true }).click();
  await page.getByRole('button', { name: 'Pedir exames', exact: true }).click();
  await page
    .getByLabel('Nome do exame · item 1', { exact: true })
    .fill('Exame fictício acompanhamento');
  await page.getByLabel('Indicação do pedido', { exact: true }).fill('Indicação fictícia.');
  await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
  await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
  await page.getByRole('button', { name: 'Emitir demonstração', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/exames');
  const exam = page
    .locator('.exam-followup-list>article')
    .filter({ hasText: 'Exame fictício acompanhamento' });
  await exam.getByRole('button', { name: 'Registrar agendamento', exact: true }).click();
  await page.getByLabel('Horário do exame').fill('10:00');
  await page.getByLabel('Local do exame').fill('Local fictício');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(exam.locator('.badge')).toHaveText('Agendado');
  await exam.getByRole('button', { name: 'Reagendar', exact: true }).click();
  await page.getByLabel('Motivo do reagendamento').fill('Novo horário fictício.');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(page.getByRole('alert')).toContainText('Altere');
  await page.getByLabel('Horário do exame').fill('11:00');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(exam.locator('.followup-summary')).toContainText('11:00');
  await exam.getByText('Histórico e resultado deste exame', { exact: true }).click();
  await expect(exam.locator('.document-history')).toContainText('10:00');
  await expect(exam.locator('.document-history')).toContainText('Novo horário fictício.');
  await page.clock.setFixedTime(new Date(addDays(dateKey(), 1) + 'T15:00:00-03:00'));
  await page.reload();
  await page.getByLabel('Etapa do exame').selectOption('overdue');
  await expect(exam).toBeVisible();
  await page.getByLabel('Etapa do exame').selectOption('cancelled');
  await expect(exam).toHaveCount(0);
});
test('HTML offline no celular registra contatos e reagenda regulação sem rolagem lateral', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#';
  await page.goto(base + '/vacinacao');
  await selectSession(page, { role: 'nursing', unitId: 'aurora-centro' });
  await createRecall(page);
  await contactRecall(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '/regulacao');
  await selectSession(page, { role: 'regulation' });
  const row = await createReferral(page);
  await row.getByRole('button', { name: 'Reagendar', exact: true }).click();
  await page.getByLabel('Horário', { exact: true }).fill('16:00');
  await page.getByLabel('Motivo do reagendamento').fill('Teste móvel offline.');
  await page.getByRole('button', { name: 'Salvar reagendamento' }).click();
  await expect(row).toContainText('16:00');
  await page.reload();
  await row.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Teste móvel offline.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
