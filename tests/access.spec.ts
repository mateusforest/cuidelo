import { test, expect } from '@playwright/test';

test('entrada inicial seleciona perfil sem autenticação e só aplica ao entrar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Cuidelo.' })).toBeVisible();
  await expect(page.locator('[data-role]')).toHaveCount(9);
  await expect(
    page.getByText('Acessos predefinidos, sem senha ou autenticação real.'),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Farmácia', exact: true }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('cuidelo.demo.context.v1')!).role),
  ).toBe('manager');
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
  await expect(page).toHaveURL(/\/farmacia$/);
  await expect(page.getByRole('heading', { name: 'Farmácia e estoque' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unidades da rede', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Unidade ativa', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Farmácia e estoque' })).toBeVisible();
  await page.getByRole('link', { name: 'Trocar sessão de demonstração', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Farmácia', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('troca de prefeitura recalcula unidade e mantém profissional demonstrativo escolhido', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Equipe médica', exact: true }).click();
  await page
    .getByLabel('Profissional de demonstração', { exact: true })
    .selectOption('aurora-centro:clinical:2');
  await page.getByLabel('Prefeitura de demonstração', { exact: true }).selectOption('horizonte');
  await expect(page.getByLabel('Unidade da sessão', { exact: true })).toHaveValue(
    'horizonte-centro',
  );
  await expect(page.getByLabel('Profissional de demonstração', { exact: true })).toHaveValue(
    'horizonte-centro:clinical:2',
  );
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
  await expect(page).toHaveURL(/\/consultorio$/);
  await expect(page.locator('.session-person')).toContainText('Dr. André');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('cuidelo.demo.context.v1')!).sessionId,
    ),
  ).toBe('horizonte-centro:clinical:2');
  await page.goto('/acesso');
  await page.getByRole('button', { name: 'Prefeitura', exact: true }).click();
  await expect(page.locator('.access-selection')).toContainText('Todas as unidades');
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
  await expect(page.getByLabel('Unidade ativa', { exact: true })).toHaveValue('all');
  await expect(page.getByRole('heading', { name: 'Visão da rede', exact: true })).toBeVisible();
});

test('celular permite entrar por teclado e abrir menu; totem e TV têm acesso direto', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Painel da TV', exact: true }).click();
  await expect(page).toHaveURL(/\/painel\?/);
  await page.goto('/acesso');
  await page.getByRole('link', { name: 'Totem', exact: true }).click();
  await expect(page).toHaveURL(/\/totem\?/);
  await page.goto('/acesso');
  await page.getByRole('button', { name: 'Recepção', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/recepcao$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.locator('.mobile-sidebar')).toBeVisible();
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page.locator('.mobile-sidebar')).toHaveCount(0);
});

test('acesso comercial não recebe contexto assistencial e entrada não apaga dados existentes', async ({
  page,
}) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('cuidelo.demo.database.v1'));
  await page.getByRole('button', { name: 'Equipe Cuidelo', exact: true }).click();
  await expect(page.getByLabel('Prefeitura de demonstração', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Unidade da sessão', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
  await expect(page).toHaveURL(/\/modulos$/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('cuidelo.demo.context.v1')!).sessionId,
    ),
  ).toBe('office:business');
  await expect(page.getByRole('link', { name: 'Pessoas e prontuários', exact: true })).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.database.v1'))).toBe(before);
  await page.goto('/acesso');
  await page.getByRole('button', { name: 'Prefeitura', exact: true }).click();
  await expect(page.getByLabel('Prefeitura de demonstração', { exact: true })).toBeEnabled();
  await page.getByLabel('Prefeitura de demonstração', { exact: true }).selectOption('aurora');
  await page.getByRole('button', { name: 'Entrar na demonstração', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão da rede', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
