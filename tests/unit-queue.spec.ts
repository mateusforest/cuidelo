import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { selectSession } from './session';

async function classify(page: Page, destination = 'consultorio-2') {
  await page.getByRole('button', { name: 'Iniciar escuta', exact: true }).click();
  await page.getByLabel('Motivo da procura', { exact: true }).fill('Relato fictício da fila.');
  await page.getByRole('button', { name: 'Salvar escuta', exact: true }).click();
  await page.getByRole('button', { name: 'Classificar e encaminhar', exact: true }).click();
  await page.getByLabel('Referência do protocolo').fill('Referência fictícia A');
  await page.getByLabel('Classificação registrada', { exact: true }).fill('Classificação de teste');
  await page.getByLabel('Faixa de chamada').selectOption('2');
  await page.getByLabel('Destino após a escuta').selectOption(destination);
  if (destination === 'orientacao')
    await page.getByRole('checkbox', { name: /Confirmo que a orientação/ }).check();
  else await page.getByLabel('Reavaliar em minutos').fill('10');
  await page
    .getByLabel('Justificativa da avaliação')
    .fill('Observação privativa da equipe fictícia.');
  await page.getByRole('button', { name: 'Salvar classificação', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('escuta → reavaliação → fila → TV → consultório → sala livre, com dados clínicos separados por perfil', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.clock.setFixedTime(new Date('2026-10-31T14:00:00Z'));
  await page.goto('/escuta/aurora-centro-e0');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await classify(page);
  await page.clock.setFixedTime(new Date('2026-10-31T14:11:00Z'));
  await page.goto('/escuta');
  await page.getByRole('button', { name: /Reavaliação pendente/ }).click();
  await page.getByRole('row').filter({ hasText: 'Ana Clara Martins' }).getByRole('link').click();
  await page.getByRole('button', { name: 'Registrar reavaliação' }).click();
  await page.getByLabel('Classificação registrada', { exact: true }).fill('Classificação revista');
  await page.getByLabel('Faixa de chamada').selectOption('1');
  await page.getByLabel('Motivo e resultado da reavaliação').fill('Revisão fictícia preservada.');
  await page.getByRole('button', { name: 'Salvar reavaliação' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/fila');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const row = page.locator('.queue-board-list article').filter({ hasText: 'Ana Clara Martins' });
  await expect(row).toContainText('Consultório 02');
  await expect(page.locator('main')).not.toContainText('Classificação revista');
  await row.getByRole('button', { name: 'Chamar senha' }).click();
  await page.getByRole('button', { name: 'Reservar sala e chamar na TV' }).click();
  const room = page.locator('.queue-room-card').filter({ hasText: 'Consultório 02' });
  await expect(room).toContainText('Reservado');
  await expect(room.getByRole('button', { name: 'Confirmar entrada' })).toHaveCount(0);
  const tv = await context.newPage();
  await tv.goto('/painel?rede=aurora&unidade=aurora-centro');
  await expect(tv.getByRole('region', { name: 'Chamada atual' })).toContainText('Consultório 02');
  await expect(tv.locator('body')).not.toContainText('Ana Clara Martins');
  await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
  await room.getByRole('button', { name: 'Confirmar entrada' }).click();
  await expect(room).toContainText('Em atendimento');
  await room.getByRole('link', { name: 'Abrir atendimento' }).click();
  await page.getByText('Histórico de classificações (2)', { exact: true }).click();
  await expect(page.locator('.assessment-log')).toContainText('Revisão fictícia preservada.');
  await page.getByLabel('A · Avaliação', { exact: true }).fill('Avaliação fictícia');
  await page.getByLabel('P · Plano', { exact: true }).fill('Plano fictício');
  await page.getByRole('button', { name: 'Salvar e concluir' }).click();
  await expect(page.getByLabel('A · Avaliação', { exact: true })).toBeDisabled();
  await page.goto('/fila');
  await expect(room).toContainText('Livre');
  await page.goto('/pessoas/aurora-p1');
  await expect(page.locator('.assessment-log')).toContainText('Referência fictícia A');
});
test('HTML portátil no celular reserva, devolve a senha e exibe o motivo no percurso', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const base = pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href;
  await page.goto(base + '#/fila');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const row = page.locator('.queue-board-list article').filter({ hasText: 'Ana Clara Martins' });
  await row.getByRole('button', { name: 'Chamar senha' }).click();
  await page.getByRole('button', { name: 'Reservar sala e chamar na TV' }).click();
  const room = page.locator('.queue-room-card').filter({ hasText: 'Consultório 01' });
  await expect(room).toContainText('Reservado');
  await room.getByRole('button', { name: 'Devolver à fila' }).click();
  await page.getByLabel('Motivo da devolução').fill('Reorganização fictícia da sala');
  await page.getByRole('button', { name: 'Liberar sala' }).click();
  await expect(room).toContainText('Livre');
  await page.reload();
  await expect(row.getByRole('button', { name: 'Chamar senha' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '#/recepcao');
  await page
    .locator('.desk-row')
    .filter({ hasText: 'Ana Clara Martins' })
    .getByRole('button', { name: 'Ver percurso' })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Reorganização fictícia da sala');
});

test('farmácia recebe o encaminhamento, chama na TV e devolve à escuta; enfermagem registra a conclusão', async ({
  page,
}) => {
  await page.goto('/escuta/aurora-centro-e0');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await classify(page, 'farmacia-1');
  await page.goto('/farmacia');
  await selectSession(page, { unitId: 'aurora-centro', role: 'pharmacy' });
  await expect(page.getByRole('heading', { name: 'Encaminhamentos ao setor' })).toBeVisible();
  await page.getByRole('button', { name: 'Chamar na TV', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Senha chamada');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await page.getByRole('button', { name: 'Devolver à escuta' }).click();
  await page.getByLabel('Motivo da devolução').fill('Rever o destino fictício.');
  await page.getByRole('button', { name: 'Confirmar devolução' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/escuta');
  await selectSession(page, { unitId: 'aurora-centro', role: 'nursing' });
  await page.getByRole('button', { name: /Devolvidos à escuta/ }).click();
  await page.getByRole('row').filter({ hasText: 'Ana Clara Martins' }).getByRole('link').click();
  await page.getByText('Histórico de classificações (1)', { exact: true }).click();
  await expect(page.locator('.assessment-log')).toContainText('Rever o destino fictício.');
  await page.getByRole('button', { name: 'Registrar reavaliação' }).click();
  await page.getByLabel('Classificação registrada', { exact: true }).fill('Reavaliação fictícia');
  await page.getByLabel('Faixa de chamada').selectOption('3');
  await page.getByLabel('Destino após a escuta').selectOption('enfermagem-1');
  await page
    .getByLabel('Motivo e resultado da reavaliação')
    .fill('Encaminhamento fictício à enfermagem');
  await page.getByRole('button', { name: 'Salvar reavaliação' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/escuta');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await page.getByRole('button', { name: 'Concluir passagem' }).click();
  await page
    .getByLabel('Resultado da passagem')
    .fill('Recebimento e orientação de teste concluídos.');
  await page.getByRole('button', { name: 'Confirmar conclusão' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/atendimento/aurora-centro-e0');
  await expect(
    page.getByRole('heading', { name: 'Atendimento encerrado após a escuta' }),
  ).toBeVisible();
});
test('orientação registrada encerra a escuta sem criar um SOAP', async ({ page }) => {
  await page.goto('/escuta/aurora-centro-e0');
  await selectSession(page, { role: 'nursing', unitId: 'aurora-centro' });
  await classify(page, 'orientacao');
  await page.goto('/atendimento/aurora-centro-e0');
  await expect(
    page.getByRole('heading', { name: 'Atendimento encerrado após a escuta' }),
  ).toBeVisible();
  await expect(page.getByLabel('A · Avaliação', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Orientação e encerramento', { exact: true })).toBeVisible();
});

test('a sala de vacinação passa de reservada a ocupada e livre no quadro da unidade', async ({
  page,
  context,
}) => {
  const unit = { unitId: 'aurora-centro', role: 'nursing' };
  await page.goto('/escuta/aurora-centro-e0');
  await selectSession(page, unit);
  const board = await context.newPage();
  await board.goto('/fila');
  const sector = (label: string) =>
    board.locator('.queue-room-card').filter({ has: board.getByText(label, { exact: true }) });
  const triage = sector('Triagem');
  await page.getByRole('button', { name: 'Chamar / rechamar para triagem' }).click();
  await expect(triage).toContainText('Reservado');
  await classify(page, 'vacina-1');
  await expect(triage).toContainText('Livre');
  const vaccine = sector('Sala de vacina');
  await page.goto('/vacinacao');
  await page.getByRole('button', { name: 'Chamar na TV', exact: true }).click();
  await expect(vaccine).toContainText('Reservado');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(vaccine).toContainText('Em atendimento');
  await board.reload();
  await expect(vaccine).toContainText('Em atendimento');
  await page.getByRole('button', { name: 'Concluir passagem' }).click();
  await page.getByLabel('Resultado da passagem').fill('Passagem fictícia encerrada.');
  await page.getByRole('button', { name: 'Confirmar conclusão' }).click();
  await expect(vaccine).toContainText('Livre');
});
