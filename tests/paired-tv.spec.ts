import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { selectSession } from './session';

const origin = process.env.CUIDELO_TV_TEST_ORIGIN || 'http://127.0.0.1:43173';

test('TV pareada exibe a chamada de outra estação isolada e retira a senha liberada', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const station = process.env.CUIDELO_TV_TEST_HTML
    ? pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#/fila'
    : origin + '/fila';
  const tvContext = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  try {
    await page.goto(station);
    await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
    await page.getByRole('button', { name: 'Gerar código para a TV' }).click();
    const code = page.locator('.tv-pair-code');
    await expect(code).toHaveText(/^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/, { timeout: 20000 });
    const tv = await tvContext.newPage();
    await tv.goto(origin + '/tv');
    await tv.getByLabel('Código de pareamento').fill((await code.innerText()).trim());
    await tv.getByRole('button', { name: 'Conectar ao painel' }).click();
    const display = tv.getByRole('region', { name: 'Chamada atual' });
    await expect(display).toContainText('Aguarde sua senha', { timeout: 12000 });
    const row = page.locator('.queue-board-list article').filter({ hasText: 'Ana Clara Martins' });
    const ticket = (await row.getByText(/A-.*Ana Clara Martins/).innerText()).match(
      /A-\d{3,4}/,
    )![0];
    await row.getByRole('button', { name: 'Chamar senha' }).click();
    await page.getByRole('button', { name: 'Reservar sala e chamar na TV' }).click();
    await expect(tv.getByTestId('current-ticket')).toHaveText(ticket, { timeout: 15000 });
    await expect(display).toContainText('Consultório 01');
    await expect(tv.locator('body')).not.toContainText('Ana Clara Martins');
    expect(
      await tv.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith('cuidelo.tv.station.')),
      ),
    ).toBe(false);
    await tvContext.setOffline(true);
    await expect(tv.getByRole('heading', { name: 'Conectar esta TV' })).toBeVisible({
      timeout: 15000,
    });
    await expect(tv.getByTestId('current-ticket')).toHaveCount(0);
    await tvContext.setOffline(false);
    await expect(tv.getByTestId('current-ticket')).toHaveText(ticket, { timeout: 15000 });
    const room = page.locator('.queue-room-card').filter({ hasText: 'Consultório 01' });
    await room.getByRole('button', { name: 'Devolver à fila' }).click();
    await page.getByLabel('Motivo da devolução').fill('Teste de liberação da sala');
    await page.getByRole('button', { name: 'Liberar sala' }).click();
    await expect(display).toContainText('Aguarde sua senha', { timeout: 15000 });
    await page.getByRole('button', { name: 'Encerrar transmissão' }).click();
    await expect(tv.getByRole('status')).toContainText('encerrada', { timeout: 15000 });
  } finally {
    await tvContext.close();
  }
});

test('o código da TV só lê sua projeção e o canal rejeita campos clínicos e escopos inválidos', async ({
  request,
}) => {
  const post = (token: string, data: object) =>
    request.post(origin + '/api/tv', { headers: { authorization: 'Bearer ' + token }, data });
  const writer = randomBytes(32).toString('hex');
  const frame = {
    op: 'publish',
    org: 'aurora',
    unit: 'aurora-centro',
    revision: 1,
    current: null,
    recent: [],
  };
  const start = await post(writer, frame);
  expect(start.status()).toBe(200);
  const { code } = await start.json();
  try {
    const read = await post(code, { op: 'read' });
    expect(await read.json()).toEqual({
      org: frame.org,
      unit: frame.unit,
      current: null,
      recent: [],
    });
    expect((await post(code, frame)).status()).toBe(403);
    expect((await post(code, { op: 'stop', org: frame.org, unit: frame.unit })).status()).toBe(403);
    expect((await post(writer, { ...frame, patientName: 'Nome fictício' })).status()).toBe(400);
    expect((await post(writer, { ...frame, unit: 'horizonte-centro' })).status()).toBe(403);
    expect(
      (await post(randomBytes(8).toString('hex').toUpperCase(), { op: 'read' })).status(),
    ).toBe(404);
  } finally {
    expect((await post(writer, { op: 'stop', org: frame.org, unit: frame.unit })).status()).toBe(
      200,
    );
  }
  expect((await post(code, { op: 'read' })).status()).toBe(410);
});
