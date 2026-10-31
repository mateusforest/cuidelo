import { test, expect } from '@playwright/test';
import { selectSession } from './session';
import { reviewTicket } from './kiosk-flow';
import inventory from '../src/data/pulso-inventory.json' with { type: 'json' };
import { demoCpf } from '../src/domain/identification';
import { createSeed } from '../src/data/seed';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('links internos e documentos pedem sessão e retomam a página originalmente aberta', async ({
  page,
}) => {
  await page.goto('/unidades');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Cuidelo.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir unidade' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recepção', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('cuidelo.demo.entry.v1'));
  await page.goto('/documentos/exemplo');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Cuidelo.' })).toBeVisible();
  await page.goto('/dispensacoes/exemplo');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Cuidelo.' })).toBeVisible();
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda da unidade' })).toBeVisible();
});
test('buscas consecutivas pelo topo atualizam o cadastro aberto, inclusive ao voltar', async ({
  page,
}) => {
  await page.goto('/pessoas');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  const input = page.getByRole('textbox', { name: 'Buscar pessoa na rede' }),
    list = page.locator('tbody');
  await input.fill('Beatriz');
  await input.press('Enter');
  await expect(list).toContainText('Beatriz Fernandes');
  await input.fill('Lúcia');
  await input.press('Enter');
  await expect(list).toContainText('Lúcia Helena Costa');
  await expect(list).not.toContainText('Beatriz');
  await page.goBack();
  await expect(list).toContainText('Beatriz Fernandes');
});
test('recepção confirma agendamento com senha do totem após conferência do vínculo', async ({
  page,
}) => {
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByLabel('CPF', { exact: true }).fill(demoCpf(5));
  await page
    .getByLabel('Data de nascimento', { exact: true })
    .fill(createSeed().patients.find((p) => p.id === 'aurora-p5')!.birthDate);
  await reviewTicket(page, { identified: true });
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toBeVisible();
  await page.goto('/agenda');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.getByRole('button', { name: 'Confirmar chegada de Beatriz Fernandes' }).click();
  await expect(page.getByRole('dialog')).toContainText('já retirou a senha');
  await page.getByRole('button', { name: 'Confirmar vínculo da senha' }).click();
  await expect(
    page.locator('article').filter({ hasText: 'Beatriz Fernandes' }).last(),
  ).toContainText('Chegada confirmada');
  await page.goto('/recepcao');
  await expect(page.locator('.desk-row').filter({ hasText: 'Beatriz Fernandes' })).toHaveCount(1);
});
test('HTML offline permite transferência com histórico e mantém a navegação por teclado', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#/hospital');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Cuidelo.' })).toBeVisible();
  await selectSession(page, { role: 'admin', unitId: 'aurora-hospital' });
  const original = page.locator('.bed-card').filter({ hasText: 'Leito 01' }),
    destino = page.locator('.bed-card').filter({ hasText: 'Leito 04' });
  await original.getByRole('button', { name: 'Transferir de leito' }).click();
  await page.getByLabel('Leito de destino').selectOption('aurora-hospital-b4');
  await page.getByLabel('Motivo da transferência').fill('Transferência de demonstração');
  await page.getByRole('button', { name: 'Confirmar transferência' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(original).toContainText('Higienização');
  await expect(destino).toContainText('Ocupado');
  await page.reload();
  await page.locator('.document-history summary').click();
  await expect(page.locator('.document-history')).toContainText('Leito 01 → Leito 04');
  await page.getByRole('link', { name: 'Ir para o conteúdo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/#\/hospital$/);
});
test('audita os links de navegação dos nove perfis e a correspondência das 46 telas', async ({
  page,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [],
    visited = new Set<string>(['/acesso']);
  page.on('pageerror', (err) => failures.push(err.message));
  for (const role of [
    'manager',
    'reception',
    'clinical',
    'nursing',
    'admin',
    'regulation',
    'pharmacy',
    'acs',
    'business',
  ]) {
    await page.goto('/modulos');
    await selectSession(page, { role, organizationId: 'aurora', unitId: 'aurora-centro' });
    await expect(page.locator('main')).toBeVisible();
    const links = await page
      .locator('nav a, main a')
      .evaluateAll((els) =>
        els
          .map((el) => el.getAttribute('href'))
          .filter((s): s is string => !!s && s.startsWith('/')),
      );
    for (const path of new Set(links)) {
      await page.goto(path);
      const main = page.locator('main');
      await expect(main, role + ' ' + path).toBeVisible();
      await expect(main.getByRole('heading').first(), role + ' ' + path).toBeVisible();
      await expect(main, role + ' ' + path).not.toContainText(
        /Página não encontrada|Não foi possível abrir esta tela|Módulo indisponível nesta sessão|Painel indisponível nesta sessão|Este módulo não faz parte do perfil/,
      );
      visited.add(path);
    }
  }
  expect(inventory.rows.filter((row) => !visited.has(row.route)).map((row) => row.id)).toEqual([]);
  expect(failures).toEqual([]);
});

test('recepção revisa uma chegada de ontem, preserva o percurso e permite uma nova chegada', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
  await page.goto('/recepcao');
  await selectSession(page, { role: 'reception', unitId: 'aurora-centro' });
  await page.clock.setFixedTime(new Date('2026-11-01T15:00:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Revisar chegadas anteriores' }).click();
  const row = page.locator('.desk-row').filter({ hasText: 'Ana Clara Martins' });
  await row.getByRole('button', { name: 'Encerrar chegada anterior' }).click();
  await page.getByLabel('Motivo do encerramento').fill('Saída anterior confirmada no balcão.');
  await page.getByRole('button', { name: 'Confirmar encerramento' }).click();
  await expect(row).toContainText('Encerrado sem atendimento');
  await row.getByRole('button', { name: 'Ver percurso' }).click();
  await expect(page.getByRole('dialog')).toContainText('Saída anterior confirmada no balcão.');
  await page.goto('/totem?rede=aurora&unidade=aurora-centro');
  await page.getByRole('button', { name: /Usar meu CPF/ }).click();
  await page.getByLabel('CPF', { exact: true }).fill(demoCpf(1));
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1988-03-14');
  await reviewTicket(page, { identified: true });
  await page.getByRole('button', { name: 'Emitir minha senha' }).click();
  await expect(page.locator('.ticket-receipt')).toBeVisible();
});
