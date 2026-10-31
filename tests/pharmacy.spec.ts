import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectSession } from './session';

async function prescription(page: Page, base = '') {
  await page.goto(base + '/atendimento/aurora-centro-e0');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Pessoa entrou · iniciar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova receita', exact: true }).click();
  for (const [label, value] of [
    ['Medicamento', 'Medicamento fictício Alfa'],
    ['Concentração', 'Concentração de teste'],
    ['Apresentação', 'Apresentação de teste'],
    ['Dose por administração', 'Dose fictícia'],
    ['Via de administração', 'Via fictícia'],
    ['Frequência', 'Frequência fictícia'],
    ['Duração', 'Duração fictícia'],
    ['Quantidade', '6'],
    ['Unidade da quantidade', 'unidade de teste'],
  ])
    await page.getByLabel(`${label} · item 1`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
  await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
  await page.getByRole('button', { name: 'Emitir demonstração' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!).clinicalDocuments[0]
        .id as string,
  );
  await selectSession(page, { role: 'pharmacy' });
  await page.goto(base + '/farmacia');
  return id;
}
async function register(page: Page, lot: string, quantity: number, fromItem = false) {
  await page
    .getByRole('button', {
      name: fromItem ? 'Cadastrar lote para item 1' : 'Novo lote de medicamento',
      exact: true,
    })
    .click();
  if (!fromItem) {
    await page
      .getByLabel('Nome do medicamento no estoque', { exact: true })
      .fill('Medicamento fictício Alfa');
    await page.getByLabel('Concentração no estoque', { exact: true }).fill('Concentração de teste');
    await page.getByLabel('Apresentação no estoque', { exact: true }).fill('Apresentação de teste');
    await page
      .getByLabel('Unidade de entrega do estoque', { exact: true })
      .fill('unidade de teste');
  }
  await page.getByLabel('Código do lote', { exact: true }).fill(lot);
  const expires = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toLocaleDateString('sv-SE');
  });
  await page.getByLabel('Validade do lote', { exact: true }).fill(expires);
  await page.getByLabel('Quantidade inicial', { exact: true }).fill(String(quantity));
  await page
    .getByLabel('Origem / referência do recebimento', { exact: true })
    .fill('Recebimento fictício para teste.');
  await page.getByRole('button', { name: 'Cadastrar lote', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return page.evaluate(
    (lot) =>
      JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!).lots.find(
        (l: { lot: string }) => l.lot === lot,
      ).id as string,
    lot,
  );
}
async function confirm(page: Page) {
  await page
    .getByRole('checkbox', {
      name: 'Conferi a identificação da pessoa ou representante que recebe',
      exact: true,
    })
    .check();
  await page
    .getByRole('checkbox', {
      name: 'Conferi a receita, os medicamentos, as unidades, as quantidades e os lotes',
      exact: true,
    })
    .check();
}
async function partial(page: Page, lotId: string, q = 2) {
  await page.getByRole('button', { name: 'Conferir e entregar', exact: true }).click();
  await page.getByLabel('Lote · item 1 · linha 1', { exact: true }).selectOption(lotId);
  await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill(String(q));
  await page
    .getByLabel('Motivo do saldo pendente', { exact: true })
    .fill('Retorno fictício para completar a entrega.');
  await confirm(page);
}

async function deliverySaved(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pharmacy-receipt-link')).toBeVisible();
}

test('consultório → farmácia → entrega parcial → conclusão por dois lotes → comprovante e histórico', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const docId = await prescription(page);
  const a = await register(page, 'ALFA-01', 3, true),
    b = await register(page, 'ALFA-02', 7);
  await partial(page, a);
  await page.getByRole('button', { name: 'Confirmar entrega parcial', exact: true }).click();
  await deliverySaved(page);
  await expect(
    page.getByTestId(`prescription-${docId}`).getByText('Entrega parcial', { exact: true }),
  ).toBeVisible();
  const first = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!).dispensations[0].id as string,
  );
  const print = await context.newPage();
  await print.goto('/dispensacoes/' + first);
  await expect(print.getByRole('heading', { name: 'Comprovante de entrega' })).toBeVisible();
  await expect(print.locator('.receipt-item')).toContainText('ALFA-01');
  await print.emulateMedia({ media: 'print' });
  await expect(print.locator('.document-sheet')).toBeVisible();
  await expect(print.getByRole('button', { name: 'Imprimir / salvar PDF' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Conferir e entregar', exact: true }).click();
  await page.getByLabel('Lote · item 1 · linha 1', { exact: true }).selectOption(a);
  await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Adicionar lote ao item 1', exact: true }).click();
  await page.getByLabel('Lote · item 1 · linha 2', { exact: true }).selectOption(b);
  await page.getByLabel('Entregar · item 1 · linha 2', { exact: true }).fill('3');
  await confirm(page);
  await page.getByRole('button', { name: 'Confirmar entrega e concluir', exact: true }).click();
  await deliverySaved(page);
  await page.getByLabel('Situação da entrega', { exact: true }).selectOption('complete');
  await expect(
    page.getByTestId(`prescription-${docId}`).getByText('Entregue por completo', { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!),
  );
  expect(saved.lots.find((l: { id: string }) => l.id === a).quantity).toBe(0);
  expect(saved.lots.find((l: { id: string }) => l.id === b).quantity).toBe(4);
  expect(saved.dispensations).toHaveLength(2);
  expect(saved.dispensations[0].balances[0].remaining).toBe(4);
  expect(saved.movements.filter((m: { dispensationId?: string }) => m.dispensationId)).toHaveLength(
    3,
  );
  await page.reload();
  await page.getByLabel('Situação da entrega', { exact: true }).selectOption('complete');
  await page.getByRole('button', { name: 'Ver receita e entregas (2)', exact: true }).click();
  await expect(page.locator('.dispensation-history')).toContainText('ALFA-02');
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await selectSession(page, { role: 'clinical', unitId: 'aurora-vila' });
  await page.goto('/pessoas/aurora-p1');
  await page.getByText('Entregas da farmácia', { exact: true }).click();
  await expect(page.locator('.dispensation-history')).toContainText('DEMO-ENT-0002');
  await selectSession(page, { role: 'admin', unitId: 'aurora-centro' });
  await page.goto('/dispensacoes/' + first);
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('excesso é recusado e cancelamento médico após entrega bloqueia o restante sem estornar estoque', async ({
  page,
  context,
}) => {
  const id = await prescription(page),
    lot = await register(page, 'ALFA-CANCEL', 10, true);
  await page.getByRole('button', { name: 'Conferir e entregar', exact: true }).click();
  await page.getByLabel('Lote · item 1 · linha 1', { exact: true }).selectOption(lot);
  await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill('7');
  await confirm(page);
  await page.getByRole('button', { name: 'Confirmar entrega e concluir' }).click();
  await expect(page.getByRole('alert')).toContainText('saldo da receita');
  await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill('2');
  await page.getByLabel('Quem recebe', { exact: true }).selectOption('representative');
  await page.getByLabel('Nome de quem recebe', { exact: true }).fill('Representante fictício');
  await page
    .getByLabel('Motivo do saldo pendente', { exact: true })
    .fill('Entrega parcial de teste');
  await page.getByRole('button', { name: 'Confirmar entrega parcial' }).click();
  await deliverySaved(page);
  await selectSession(page, { role: 'clinical' });
  await page.goto('/atendimento/aurora-centro-e0');
  await expect(page.locator('.clinical-document-list')).toContainText('entrega parcial registrada');
  await page.getByRole('button', { name: 'Cancelar documento', exact: true }).click();
  await page
    .getByLabel('Justificativa', { exact: true })
    .fill('Cancelamento fictício após entrega');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await selectSession(page, { role: 'pharmacy' });
  await page.goto('/farmacia');
  await page.getByLabel('Situação da entrega', { exact: true }).selectOption('cancelled');
  const row = page.getByTestId(`prescription-${id}`);
  await expect(row).toContainText('Receita cancelada');
  await expect(row.getByRole('button', { name: 'Conferir e entregar' })).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!),
  );
  expect(saved.lots.find((l: { id: string }) => l.id === lot).quantity).toBe(8);
  expect(saved.dispensations).toHaveLength(1);
  const receipt = await context.newPage();
  await receipt.goto('/dispensacoes/' + saved.dispensations[0].id);
  await expect(receipt.locator('.document-sheet')).toContainText('Representante fictício');
  await expect(receipt.locator('.document-cancelled')).toContainText(
    'não houve devolução automática',
  );
});

test('duas conferências simultâneas não duplicam a baixa e a segunda precisa revisar o saldo', async ({
  page,
  context,
}) => {
  await prescription(page);
  const lot = await register(page, 'ALFA-ABAS', 10, true);
  await partial(page, lot);
  const second = await context.newPage();
  await second.goto('/farmacia');
  await partial(second, lot);
  await page.getByRole('button', { name: 'Confirmar entrega parcial' }).click();
  await deliverySaved(page);
  await expect(
    second.getByText('Os dados foram atualizados desde a abertura.', { exact: false }),
  ).toBeVisible();
  await second.getByRole('button', { name: 'Confirmar entrega parcial' }).click();
  await expect(second.getByRole('alert')).toContainText('mudaram');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!),
  );
  expect(saved.dispensations).toHaveLength(1);
  expect(saved.lots.find((l: { id: string }) => l.id === lot).quantity).toBe(8);
  second.once('dialog', (d) => d.accept());
  await second.getByRole('button', { name: 'Voltar sem registrar' }).click();
  await second.getByRole('button', { name: 'Conferir e entregar' }).click();
  await expect(second.locator('.delivery-balance')).toContainText('Já entregue: 2');
});

test('HTML offline no celular recebe receita, cadastra lote, entrega e abre comprovante sem rolagem lateral', async ({
  page,
}) => {
  await page.route('http://**/*', (r) => r.abort());
  await page.route('https://**/*', (r) => r.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#';
  await prescription(page, base);
  const lot = await register(page, 'ALFA-OFFLINE', 6, true);
  await page.getByRole('button', { name: 'Conferir e entregar' }).click();
  await page.getByLabel('Lote · item 1 · linha 1', { exact: true }).selectOption(lot);
  await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill('6');
  await confirm(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Confirmar entrega e concluir' }).click();
  await deliverySaved(page);
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cuidelo.demo.database.v1')!).dispensations[0].id as string,
  );
  await page.goto(base + '/dispensacoes/' + id);
  await expect(page.getByRole('heading', { name: 'Comprovante de entrega' })).toBeVisible();
  await expect(page.locator('.receipt-item')).toContainText('ALFA-OFFLINE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('.document-sheet')).toContainText('Saldo da receita concluído');
});

for (const portable of [false, true]) {
  const surface = portable ? 'no HTML offline em tela de celular' : 'na web';
  test(`farmácia ${surface} · devolução e estorno por lote preservam a entrega original`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    const base = portable ? pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#' : '';
    if (portable) {
      await context.setOffline(true);
      await page.setViewportSize({ width: 390, height: 844 });
    }
    const docId = await prescription(page, base);
    const firstCode = 'AJUSTE-01',
      secondCode = 'AJUSTE-02';
    const firstLot = await register(page, firstCode, 5, true);
    const secondLot = await register(page, secondCode, 5);
    const card = page.getByTestId('prescription-' + docId);
    await card.getByRole('button', { name: 'Conferir e entregar' }).click();
    await page.getByLabel('Lote · item 1 · linha 1', { exact: true }).selectOption(firstLot);
    await page.getByLabel('Entregar · item 1 · linha 1', { exact: true }).fill('4');
    await page.getByRole('button', { name: 'Adicionar lote ao item 1' }).click();
    await page.getByLabel('Lote · item 1 · linha 2', { exact: true }).selectOption(secondLot);
    await page.getByLabel('Entregar · item 1 · linha 2', { exact: true }).fill('2');
    await confirm(page);
    await page.getByRole('button', { name: 'Confirmar entrega e concluir' }).click();
    await deliverySaved(page);
    const popup = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Abrir último comprovante' }).click();
    const receipt = await popup;
    await expect(receipt.getByRole('heading', { name: 'Comprovante de entrega' })).toBeVisible();
    const number = await receipt.locator('.document-sheet-title strong').innerText();
    const originalItems = await receipt.locator('.receipt-item').innerText();
    const originalUrl = receipt.url();
    await receipt.close();

    const returnReason = 'Material fictício recebido no balcão.';
    const reversalReason = 'Uma unidade fictícia permaneceu na farmácia.';
    async function openDelivery(search: string) {
      await page.getByRole('button', { name: 'Localizar entrega' }).click();
      const input = page.getByRole('searchbox', { name: 'Buscar pessoa, comprovante ou lote' });
      await input.fill('SEM-CORRESPONDENCIA');
      await expect(card).toHaveCount(0);
      await input.fill(search);
      await card.getByRole('button', { name: 'Ver receita e entregas (1)' }).click();
      await expect(page.getByRole('dialog')).toContainText(number);
    }
    async function adjust(
      action: 'devolução' | 'estorno',
      lot: string,
      available: number,
      qty: number,
      reason: string,
    ) {
      await page.getByRole('button', { name: 'Registrar ' + action, exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Registrar ' + action, exact: true });
      await editor.getByLabel('Item e lote da entrega').selectOption({
        label:
          'Medicamento fictício Alfa · lote ' + lot + ' · até ' + available + ' unidade de teste',
      });
      await editor.getByLabel('Quantidade do ajuste').fill(String(qty));
      await editor.getByLabel('Motivo do ajuste').fill(reason);
      await editor.getByRole('checkbox').check();
      await editor.getByRole('button', { name: 'Confirmar ' + action }).click();
      await expect(
        page.getByRole('region', { name: 'Ajustes da entrega ' + number }),
      ).toContainText(reason);
      await page.getByRole('dialog').getByRole('button', { name: 'Fechar janela' }).click();
    }
    async function checkStock(code: string, available: number, segregated: number) {
      const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: code, exact: true }) });
      await expect(row.getByText('Disponível · ' + available, { exact: true })).toBeVisible();
      await expect(row.getByText('Segregado · ' + segregated, { exact: true })).toBeVisible();
    }
    const prescriptionBalance = (label: string) =>
      card
        .locator('dl > div')
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator('dd');
    await openDelivery(firstCode);
    await adjust('devolução', firstCode, 4, 2, returnReason);
    await checkStock(firstCode, 1, 2);
    await expect(card.getByText('Entregue por completo', { exact: true })).toBeVisible();
    await expect(prescriptionBalance('Pendente')).toHaveText('0');
    await openDelivery(number);
    await adjust('estorno', secondCode, 2, 1, reversalReason);
    await page.reload();
    await checkStock(firstCode, 1, 2);
    await checkStock(secondCode, 4, 0);
    await expect(card.getByText('Entrega parcial', { exact: true })).toBeVisible();
    await expect(prescriptionBalance('Entregue')).toHaveText('5');
    await expect(prescriptionBalance('Pendente')).toHaveText('1');
    await page.goto(originalUrl);
    await expect(page.locator('.receipt-item')).toHaveText(originalItems, { useInnerText: true });
    const audit = page.getByRole('region', { name: 'Ajustes da entrega ' + number });
    await expect(audit.getByRole('listitem')).toHaveCount(2);
    const returned = audit.getByRole('listitem').filter({ hasText: returnReason });
    await expect(returned).toContainText(firstCode);
    await expect(returned).toContainText('Entrada em estoque segregado · de 0 para 2');
    const reversed = audit.getByRole('listitem').filter({ hasText: reversalReason });
    await expect(reversed).toContainText(secondCode);
    await expect(reversed).toContainText('Reposição no saldo do lote · de 3 para 4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await selectSession(page, { role: 'clinical', unitId: 'aurora-vila' });
    await page.goto(base + '/pessoas/aurora-p1');
    await page.getByText('Entregas da farmácia', { exact: true }).click();
    await expect(audit).toContainText(returnReason);
    await expect(audit).toContainText(reversalReason);
    await expect(page.getByRole('button', { name: /Registrar (devolução|estorno)/ })).toHaveCount(
      0,
    );
  });
}
