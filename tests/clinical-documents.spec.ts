import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';

async function start(page: Page) {
  await page.goto('/atendimento/aurora-centro-e0');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Pessoa entrou · iniciar', exact: true }).click();
}
async function rx(page: Page, index = 1) {
  for (const [label, value] of [
    ['Medicamento', `Medicamento fictício ${index}`],
    ['Concentração', 'Concentração de teste'],
    ['Apresentação', 'Apresentação fictícia'],
    ['Dose por administração', 'Dose fictícia'],
    ['Via de administração', 'Via de teste'],
    ['Frequência', 'Frequência de teste'],
    ['Duração', 'Duração de teste'],
    ['Quantidade', '2'],
    ['Unidade da quantidade', 'Unidades de teste'],
  ])
    await page.getByLabel(`${label} · item ${index}`, { exact: true }).fill(value);
}
async function saveDocument(page: Page) {
  await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
  await expect(page.getByRole('dialog')).toContainText('revisão');
}
async function issue(page: Page) {
  await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
  await page.getByRole('button', { name: 'Emitir demonstração', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function finish(page: Page) {
  await page.getByLabel('A · Avaliação', { exact: true }).fill('Avaliação fictícia para teste.');
  await page.getByLabel('P · Plano', { exact: true }).fill('Plano fictício para teste.');
  const code = page.getByRole('button', { name: 'R05 · Tosse', exact: true });
  if (await code.isEnabled()) await code.click();
  await page.getByRole('button', { name: 'Salvar e concluir' }).click();
}
async function getDocs(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!).clinicalDocuments as {
        id: string;
        referralId?: string;
        content: { kind: string; items?: { id: string }[] };
        status: string;
      }[],
  );
}

test('receita com vários itens preserva SOAP, valida emissão, imprime e mantém cancelamento entre abas', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await page
    .getByLabel('S · Subjetivo', { exact: true })
    .fill('Texto ainda não salvo do atendimento.');
  await page.getByRole('button', { name: 'Nova receita', exact: true }).click();
  await rx(page);
  await page.getByRole('button', { name: 'Adicionar medicamento', exact: true }).click();
  await rx(page, 2);
  await page.getByLabel('Dose por administração · item 2', { exact: true }).fill('');
  await saveDocument(page);
  await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
  await page.getByRole('button', { name: 'Emitir demonstração' }).click();
  await expect(page.getByRole('alert')).toContainText('dose');
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await page.getByRole('button', { name: 'Editar rascunho' }).click();
  await page.getByLabel('Dose por administração · item 2', { exact: true }).fill('Dose fictícia');
  await saveDocument(page);
  await issue(page);
  await expect(page.getByLabel('S · Subjetivo', { exact: true })).toHaveValue(
    'Texto ainda não salvo do atendimento.',
  );
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('Salvo');
  const doc = (await getDocs(page))[0],
    print = await context.newPage();
  await print.goto(`/documentos/${doc.id}`);
  await expect(print.getByRole('heading', { name: 'Receita', exact: true })).toBeVisible();
  await expect(print.locator('.prescription-items>li')).toHaveCount(2);
  await print.emulateMedia({ media: 'print' });
  await expect(print.locator('.document-sheet')).toBeVisible();
  await expect(print.getByRole('button', { name: 'Imprimir / salvar PDF' })).not.toBeVisible();
  await expect(print.locator('.document-print-warning')).toContainText('SEM ASSINATURA');
  await page.getByRole('button', { name: 'Cancelar documento', exact: true }).click();
  await page
    .getByLabel('Justificativa', { exact: true })
    .fill('Cancelamento fictício para testar preservação.');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(print.locator('.document-cancelled')).toContainText('Cancelamento fictício');
  await expect(print.locator('.prescription-items>li')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.clinical-document-list')).toContainText('Cancelado');
  await expect(page.getByLabel('S · Subjetivo', { exact: true })).toHaveValue(
    'Texto ainda não salvo do atendimento.',
  );
  expect(errors).toEqual([]);
});

test('pedido com dois exames, bloqueio de rascunho ao concluir, resultados pela enfermagem e revisão médica', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Pedir exames', exact: true }).click();
  await page.getByLabel('Nome do exame · item 1', { exact: true }).fill('Exame fictício Alfa');
  await page.getByRole('button', { name: 'Adicionar exame' }).click();
  await page.getByLabel('Nome do exame · item 2', { exact: true }).fill('Exame fictício Beta');
  await page.getByLabel('Indicação do pedido', { exact: true }).fill('Indicação fictícia');
  await saveDocument(page);
  await issue(page);
  await page.getByRole('button', { name: 'Nova receita', exact: true }).click();
  await saveDocument(page);
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await finish(page);
  await expect(page.getByRole('alert')).toContainText('documentos em rascunho');
  await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
  await page
    .getByLabel('Justificativa', { exact: true })
    .fill('Rascunho criado somente para teste.');
  await page.getByRole('button', { name: 'Confirmar descarte' }).click();
  await finish(page);
  await expect(page.locator('.save-state')).toContainText('Finalizado');
  await selectSession(page, { role: 'nursing' });
  await page.goto('/exames');
  const first = page
      .locator('.exam-followup-list>article')
      .filter({ hasText: 'Exame fictício Alfa' }),
    second = page.locator('.exam-followup-list>article').filter({ hasText: 'Exame fictício Beta' });
  await first.getByRole('button', { name: 'Registrar agendamento', exact: true }).click();
  await page.getByLabel('Horário do exame', { exact: true }).fill('15:00');
  await page.getByLabel('Local do exame', { exact: true }).fill('Laboratório fictício');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(first.locator('.badge')).toHaveText('Agendado');
  await expect(second.locator('.badge')).toHaveText('Solicitado');
  await first.getByRole('button', { name: 'Registrar realização' }).click();
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await first.getByRole('button', { name: 'Registrar resultado', exact: true }).click();
  await page
    .getByLabel('Resumo transcrito do resultado', { exact: true })
    .fill('Resultado fictício transcrito para demonstração.');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(first.locator('.badge')).toHaveText('Resultado registrado');
  await expect(page.getByRole('button', { name: 'Salvar acompanhamento' })).toHaveCount(0);
  await expect(first.getByRole('button', { name: 'Revisar resultado' })).toHaveCount(0);
  await selectSession(page, { role: 'clinical' });
  await first.getByRole('button', { name: 'Revisar resultado' }).click();
  await page
    .getByLabel('Revisão e plano de acompanhamento', { exact: true })
    .fill('Revisão fictícia pelo médico responsável.');
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(first.locator('.badge')).toHaveText('Revisado pelo médico');
  await page.reload();
  await expect(first).toContainText('Resultado fictício transcrito');
  await expect(first).toContainText('Revisão fictícia');
});

test('encaminhamento do consultório chega à regulação, recebe retorno e compartilha histórico na prefeitura', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Encaminhar', exact: true }).click();
  await page
    .getByLabel('Especialidade ou serviço solicitado', { exact: true })
    .fill('Especialidade fictícia');
  await page.getByLabel('Destino solicitado', { exact: true }).fill('Serviço fictício de destino');
  await page
    .getByLabel('Justificativa do encaminhamento', { exact: true })
    .fill('Justificativa clínica fictícia reservada.');
  await page
    .getByLabel('Resumo para continuidade do cuidado', { exact: true })
    .fill('Resumo fictício para teste.');
  await saveDocument(page);
  await issue(page);
  const doc = (await getDocs(page))[0];
  await selectSession(page, { role: 'regulation' });
  await page.goto(`/regulacao?encaminhamento=${doc.referralId}`);
  await expect(page.getByRole('row').filter({ hasText: 'Especialidade fictícia' })).toContainText(
    'Solicitado no consultório',
  );
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  await page.getByLabel('Data', { exact: true }).fill(today);
  await page.getByRole('button', { name: 'Registrar agendamento', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar retorno' }).click();
  await page
    .getByLabel('Resumo da contrarreferência', { exact: true })
    .fill('Contrarreferência fictícia preservada para continuidade.');
  await page.getByRole('button', { name: 'Concluir com contrarreferência' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Especialidade fictícia' })).toContainText(
    'Concluído com retorno',
  );
  await selectSession(page, { role: 'admin' });
  await page.getByRole('button', { name: 'Detalhes', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('Contrarreferência fictícia');
  await expect(page.getByRole('dialog')).not.toContainText('Justificativa clínica fictícia');
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await selectSession(page, { role: 'clinical', unitId: 'aurora-vila' });
  await page.goto('/pessoas/aurora-p1');
  await expect(page.locator('.referral-response')).toContainText('Contrarreferência fictícia');
  await page.goto(`/documentos/${doc.id}`);
  await expect(page.locator('.document-sheet')).toContainText('Justificativa clínica fictícia');
  await selectSession(page, {
    role: 'clinical',
    organizationId: 'horizonte',
    unitId: 'horizonte-centro',
  });
  await expect(
    page.getByRole('heading', { name: 'Documento emitido não encontrado' }),
  ).toBeVisible();
});

test('HTML portátil funciona sem rede, com documento no celular e impressão preservada', async ({
  page,
}) => {
  await page.route('http://**/*', (route) => route.abort());
  await page.route('https://**/*', (route) => route.abort());
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '#/atendimento/aurora-centro-e0');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Pessoa entrou · iniciar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova receita', exact: true }).click();
  await rx(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await saveDocument(page);
  await issue(page);
  const doc = (await getDocs(page))[0];
  await page.goto(base + `#/documentos/${doc.id}`);
  await expect(page.getByRole('heading', { name: 'Receita', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.document-body')).toBeVisible();
  await expect(page.locator('.document-sheet')).toContainText('Medicamento fictício 1');
});
