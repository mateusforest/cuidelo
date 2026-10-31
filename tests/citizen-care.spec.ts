import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const origin = process.env.CUIDELO_CARE_TEST_ORIGIN || 'http://127.0.0.1:43173';
test('diário no celular preserva sintomas, doses, datas da farmácia e relatório por pessoa', async ({
  page,
}) => {
  test.setTimeout(65000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(new Date('2026-10-31T15:00:00-03:00'));
  await page.goto(origin + '/cidadao');
  await page.getByRole('button', { name: /Ana Clara/ }).click();
  await page.getByRole('link', { name: 'Dia a dia', exact: true }).click();
  await page.getByRole('link', { name: 'Registrar crise ou sintoma' }).click();
  await page.getByLabel('Condição relacionada (opcional)').fill('Ansiedade');
  await page.getByLabel('Intensidade percebida').selectOption('Moderada');
  await page.getByLabel('Duração em minutos').fill('12');
  await page.getByLabel('Meu relato').fill('Relato fictício para a consulta.');
  await page.getByRole('button', { name: 'Salvar relato' }).click();
  await expect(page.locator('.care-timeline')).toContainText('12 min');
  await page.getByRole('link', { name: 'Medicação', exact: true }).click();
  await page.getByRole('button', { name: 'Novo lembrete' }).click();
  await page.getByLabel('Origem do lembrete').selectOption({ index: 1 });
  await page.getByLabel('Condição relacionada (opcional)').fill('Esclerose múltipla');
  await page.getByLabel('Horários diários').fill('07:00, 21:00');
  await page.getByLabel('Próxima retirada', { exact: true }).fill('2026-11-02');
  await page.getByLabel('Próxima renovação', { exact: true }).fill('2026-11-03');
  await page.getByRole('button', { name: 'Salvar lembrete' }).click();
  await expect(page.locator('.care-med')).toContainText('Vinculado à receita');
  await page.getByText('Receber avisos com o app fechado', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar para o calendário' }).click();
  const ics = await download;
  expect(await readFile((await ics.path())!, 'utf8')).toContain('BEGIN:VALARM');
  await page.getByRole('link', { name: 'Hoje', exact: true }).click();
  await expect(page.locator('.care-workspace')).toContainText('Retirada · 02/11/2026');
  await page.getByRole('button', { name: 'Tomei', exact: true }).click();
  await expect(page.locator('.care-slot').first()).toContainText('Registrado: tomei');
  await page.getByRole('button', { name: 'Corrigir registro' }).click();
  await page.getByLabel('Motivo da correção').fill('Correção fictícia');
  await page.getByRole('button', { name: 'Confirmar correção' }).click();
  await expect(page.locator('.care-slot').first()).toContainText('Registrado: não tomei');
  await page.getByRole('link', { name: 'Medicação', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar retirada' }).click();
  await page.getByLabel('Próxima data informada (opcional)').fill('2026-12-02');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.locator('.care-med')).toContainText('02/12/2026');
  await page.getByRole('link', { name: 'Relatório', exact: true }).click();
  await expect(page.locator('.care-report')).toContainText('Relato fictício para a consulta.');
  await page.reload();
  await expect(page.locator('.care-report')).toContainText('Correção fictícia');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.care-report .care-timeline')).toBeVisible();
  await expect(page.locator('.cit-nav')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Sair do app do cidadão' }).click();
  await page.getByRole('button', { name: /João Pedro/ }).click();
  await page.goto(origin + '/cidadao/dia-a-dia/relatorio');
  await expect(page.locator('.care-report')).not.toContainText('Correção fictícia');
  await expect(page.locator('.care-report')).not.toContainText('Ansiedade');
});
test('horário do aparelho gera um aviso genérico e mantém o relato no aparelho', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'], { origin });
  await page.goto(origin + '/cidadao');
  await page.getByRole('button', { name: /João Pedro/ }).click();
  await page.goto(origin + '/cidadao/dia-a-dia/medicacao');
  await page.getByRole('button', { name: 'Novo lembrete' }).click();
  await page.getByLabel('Nome do medicamento').fill('Medicamento fictício de teste');
  const hhmm = await page.evaluate(() => {
    const t = new Date();
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  });
  await page.getByLabel('Horários diários').fill(hhmm);
  await page.getByRole('button', { name: 'Salvar lembrete' }).click();
  await expect(page.locator('.care-med')).toBeVisible();
  await page.getByRole('button', { name: 'Ativar avisos do aparelho' }).click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration('/cidadao/');
        return (await r?.getNotifications())?.map((n) => [n.title, n.body]);
      }),
    )
    .toEqual([
      ['Cuidelo · lembrete pessoal', 'Você tem um horário ou uma data para conferir em Dia a dia.'],
    ]);
  await page.getByRole('button', { name: 'Desativar avisos' }).click();
  await expect(page.getByRole('button', { name: 'Ativar avisos do aparelho' })).toBeVisible();
});
