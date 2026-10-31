import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';

for (const portable of [false, true]) {
  test(
    'consulta completa da chamada ao prontuário ' + (portable ? 'no HTML offline' : 'na web'),
    async ({ page, context }) => {
      test.setTimeout(70000);
      const app = portable
        ? pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#'
        : process.env.CUIDELO_CONSULT_TEST_ORIGIN || 'http://127.0.0.1:43173';
      if (portable) {
        await context.setOffline(true);
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await page.goto(app + '/consultorio');
      await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
      const person = page
        .locator('.consulting-list article')
        .filter({ hasText: 'Ana Clara Martins' });
      await person.getByRole('button', { name: 'Chamar / rechamar na TV' }).click();
      const tv = await context.newPage();
      await tv.goto(app + '/painel?rede=aurora&unidade=aurora-centro');
      await expect(tv.getByRole('region', { name: 'Chamada atual' })).toContainText(
        'Consultório 01',
      );
      await person.getByRole('button', { name: 'Devolver senha à fila' }).click();
      await page.getByLabel('Motivo da devolução').fill('Ausência fictícia');
      await page.getByRole('button', { name: 'Confirmar devolução' }).click();
      await expect(tv.getByRole('region', { name: 'Chamada atual' })).toContainText(
        'Aguarde sua senha',
      );
      await person.getByRole('button', { name: 'Chamar / rechamar na TV' }).click();
      await person.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
      await page.getByRole('link', { name: 'Continuar registro clínico' }).click();
      await page.getByLabel('A · Avaliação', { exact: true }).fill('Avaliação de teste.');
      await page
        .getByLabel('P · Plano', { exact: true })
        .fill('Plano registrado para demonstração.');
      await page.getByRole('button', { name: 'Salvar e concluir' }).click();
      await expect(page.getByRole('alert')).toContainText('justifique');
      await page.getByLabel('Buscar código ou descrição').fill('tosse');
      await page.getByRole('button', { name: 'R05 · Tosse' }).click();
      await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
      await expect(page.locator('.save-state')).toContainText('Salvo');
      await page.reload();
      await expect(page.locator('.recorded-codes')).toContainText('CIAP-2 · R05');
      await page.getByRole('button', { name: 'Emitir atestado', exact: true }).click();
      await page.getByLabel('Data de início do afastamento').fill('2026-10-31');
      await page.getByLabel('Dias de afastamento').fill('2');
      await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
      await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
      await page.getByRole('button', { name: 'Emitir demonstração' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Salvar e concluir' }).click();
      await page.getByRole('link', { name: 'Ver consulta no prontuário' }).click();
      await expect(
        page.locator('.timeline-note').filter({ hasText: 'Avaliação de teste.' }),
      ).toContainText('CIAP-2 · R05');
      await expect(page.getByText(/Atestado · DEMO-AT-/).first()).toBeVisible();
      if (!portable) {
        const chart = page.url();
        await selectSession(page, { role: 'clinical', unitId: 'aurora-vila' });
        await expect(
          page.locator('.timeline-note').filter({ hasText: 'Avaliação de teste.' }),
        ).toContainText('CIAP-2 · R05');
        await selectSession(page, {
          organizationId: 'horizonte',
          role: 'clinical',
          unitId: 'horizonte-centro',
        });
        await expect(
          page.locator('.timeline-note').filter({ hasText: 'Avaliação de teste.' }),
        ).toHaveCount(0);
        await selectSession(page, {
          organizationId: 'aurora',
          role: 'clinical',
          unitId: 'aurora-centro',
        });
        await page.goto(chart);
      }
      await page.goto(app + '/fila');
      await expect(
        page.locator('.queue-room-card').filter({ hasText: 'Consultório 01' }),
      ).toContainText('Livre');
    },
  );
}

test('declaração de comparecimento é revisada, impressa e recuperada após recarregar', async ({
  page,
  context,
}) => {
  const app = process.env.CUIDELO_CONSULT_TEST_ORIGIN || 'http://127.0.0.1:43173';
  await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
  await page.goto(app + '/atendimento/aurora-centro-e0');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
  await page.getByRole('button', { name: 'Declarar comparecimento' }).click();
  await page.getByLabel('Início do comparecimento').fill('2026-10-31T11:20');
  await page.getByLabel('Fim do comparecimento').fill('2026-10-31T12:00');
  await page.getByRole('button', { name: 'Salvar documento em rascunho' }).click();
  await page.getByRole('checkbox', { name: /Revisei a pessoa/ }).check();
  await page.getByRole('button', { name: 'Emitir demonstração' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  const link = page
    .locator('.clinical-document-list')
    .getByRole('link', { name: 'Abrir impressão' });
  const print = await context.newPage();
  await print.goto(new URL((await link.getAttribute('href'))!, app).href);
  await expect(print.getByRole('heading', { name: 'Declaração de comparecimento' })).toBeVisible();
  await expect(print.locator('.document-sheet')).toContainText('11:20');
  await expect(print.locator('.document-sheet')).toContainText('12:00');
  await print.emulateMedia({ media: 'print' });
  await expect(print.locator('.document-print-warning')).toBeVisible();
});
