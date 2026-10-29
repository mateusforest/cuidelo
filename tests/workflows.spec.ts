import { test, expect } from '@playwright/test';

test('cadastro → agenda → chegada → registro finalizado e persistido', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão da rede', exact: true })).toBeVisible();
  await page.getByLabel('Unidade ativa').selectOption('aurora-centro');
  await page.getByRole('link', { name: 'Pessoas e prontuários', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar pessoa', exact: true }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Teste de Fluxo');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1990-04-15');
  await page.getByRole('button', { name: 'Criar cadastro' }).click();
  await expect(
    page.getByRole('link', { name: 'Pessoa Teste de Fluxo Registro fictício' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const patientId = await page
    .locator('select[name="patient"] option')
    .filter({ hasText: 'Pessoa Teste de Fluxo' })
    .getAttribute('value');
  await page.getByLabel('Pessoa', { exact: true }).selectOption(patientId!);
  await page.getByLabel('Horário', { exact: true }).fill('18:30');
  await page.getByRole('button', { name: 'Agendar atendimento' }).click();
  await page
    .locator('.appointment-row')
    .filter({ hasText: 'Pessoa Teste de Fluxo' })
    .getByRole('button', { name: 'Confirmar chegada de Pessoa Teste de Fluxo' })
    .click();
  await expect(
    page.locator('.appointment-row').filter({ hasText: 'Pessoa Teste de Fluxo' }),
  ).toContainText('Chegada confirmada');
  await page.getByRole('link', { name: 'Recepção e atendimento', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Pessoa Teste de Fluxo' })
    .getByRole('button', { name: 'Atender', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'S · Subjetivo', exact: true })
    .fill('Texto fictício para verificar o percurso.');
  await page
    .getByRole('textbox', { name: 'A · Avaliação', exact: true })
    .fill('Avaliação de demonstração.');
  await page
    .getByRole('textbox', { name: 'P · Plano', exact: true })
    .fill('Plano de demonstração.');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Rascunho salvo');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'S · Subjetivo', exact: true })).toHaveValue(
    'Texto fictício para verificar o percurso.',
  );
  await page.getByRole('button', { name: 'Salvar e concluir' }).click();
  await expect(page.getByText('Registro concluído', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'P · Plano', exact: true })).toBeDisabled();
  await page.getByLabel('Rede ativa').selectOption('horizonte');
  await page.goto(`/pessoas/${patientId}`);
  await expect(
    page.getByRole('heading', { name: 'Cadastro não encontrado nesta rede' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('admissão, bloqueio de duplicidade, saída e liberação do leito', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Unidade ativa').selectOption('aurora-hospital');
  await page.getByRole('link', { name: 'Internação e leitos', exact: true }).click();
  const bed = page.locator('.bed-card').filter({ hasText: 'Leito 04' });
  await bed.getByRole('button', { name: 'Admitir', exact: true }).click();
  await page.getByLabel('Pessoa', { exact: true }).selectOption('aurora-p5');
  await page.getByRole('button', { name: 'Registrar admissão' }).click();
  await expect(bed).toContainText('Beatriz Fernandes');
  await page.getByRole('button', { name: 'Nova admissão' }).click();
  await page.getByLabel('Pessoa', { exact: true }).selectOption('aurora-p5');
  await page.getByLabel('Leito', { exact: true }).selectOption('aurora-hospital-b6');
  await page.getByRole('button', { name: 'Registrar admissão' }).click();
  await expect(page.getByRole('alert')).toContainText('internação ativa');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await bed.getByRole('button', { name: 'Registrar saída' }).click();
  await page.getByLabel('Motivo e observação da saída').fill('Saída administrativa fictícia.');
  await page.getByRole('button', { name: 'Registrar saída', exact: true }).last().click();
  await expect(bed).toContainText('Higienização');
  await bed.getByRole('button', { name: 'Atualizar situação' }).click();
  await page.getByLabel('Justificativa', { exact: true }).fill('Higienização concluída no teste.');
  await page.getByRole('button', { name: 'Atualizar leito' }).click();
  await expect(bed).toContainText('Disponível');
});

test('perfil de recepção não acessa clínica e redes mantêm cadastros distintos', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Perfil de demonstração').selectOption('reception');
  await page.goto('/pessoas/aurora-p1');
  await expect(
    page.getByText('Este perfil pode consultar o cadastro', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Penicilina', { exact: false })).toHaveCount(0);
  await page.goto('/hospital');
  await expect(
    page.getByRole('heading', { name: 'Este módulo não faz parte do perfil selecionado' }),
  ).toBeVisible();
  await page.getByLabel('Rede ativa').selectOption('horizonte');
  await page.goto('/pessoas/aurora-p1');
  await expect(
    page.getByRole('heading', { name: 'Cadastro não encontrado nesta rede' }),
  ).toBeVisible();
});

test('estoque persiste o movimento e bloqueia uso de lote vencido', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Unidade ativa').selectOption('aurora-centro');
  await page.getByRole('link', { name: 'Farmácia e estoque', exact: true }).click();
  await page
    .getByRole('button', { name: 'Saída de Gaze estéril', exact: true })
    .isDisabled()
    .then((v) => expect(v).toBe(true));
  await page.getByRole('button', { name: 'Saída de Paracetamol', exact: true }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('5');
  await page.getByLabel('Motivo e referência').fill('Movimento fictício para verificação.');
  await page.getByRole('button', { name: 'Registrar movimento' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Paracetamol' })).toContainText('115');
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Paracetamol' })).toContainText('115');
  await expect(
    page.getByText('Movimento fictício para verificação.', { exact: false }),
  ).toBeVisible();
});

test('navegação móvel e formulários cabem na tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Unidade ativa').selectOption('aurora-centro');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Pessoas e prontuários', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar pessoa', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page.getByRole('dialog').evaluate((e) => e.getBoundingClientRect().right <= innerWidth),
  ).toBe(true);
});

test('encaminhamento passa de solicitação a agendamento e cancelamento persistido', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Unidade ativa').selectOption('aurora-centro');
  await page.getByRole('link', { name: 'Regulação', exact: true }).click();
  await page.getByRole('button', { name: 'Novo encaminhamento' }).click();
  await page.getByLabel('Pessoa', { exact: true }).selectOption('aurora-p5');
  await page.getByLabel('Especialidade', { exact: true }).selectOption('Neurologia');
  await page.getByLabel('Serviço de destino').fill('Serviço fictício de teste');
  await page
    .getByLabel('Justificativa', { exact: true })
    .fill('Solicitação fictícia para validar o percurso.');
  await page.getByRole('button', { name: 'Criar solicitação' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Serviço fictício de teste' });
  await expect(row).toContainText('Solicitado');
  await row.getByRole('button', { name: 'Agendar', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar agendamento', exact: true }).click();
  await expect(row).toContainText('Agendado');
  await row.getByRole('button', { name: 'Cancelar encaminhamento de Beatriz Fernandes' }).click();
  await page.getByLabel('Motivo', { exact: true }).fill('Cancelamento fictício de teste.');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(row).toContainText('Cancelado');
  await page.reload();
  await expect(row).toContainText('Cancelado');
  await expect(row.getByRole('button', { name: 'Agendar', exact: true })).toHaveCount(0);
});

test('rascunho não salvo exige decisão antes de sair ou trocar a rede', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Unidade ativa').selectOption('aurora-centro');
  await page.getByRole('link', { name: 'Recepção e atendimento', exact: true }).click();
  await page.getByRole('button', { name: 'Atender', exact: true }).first().click();
  await page
    .getByRole('textbox', { name: 'S · Subjetivo', exact: true })
    .fill('Texto fictício ainda não salvo.');
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Salvar seu rascunho primeiro?');
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByRole('textbox', { name: 'S · Subjetivo', exact: true })).toHaveValue(
    'Texto fictício ainda não salvo.',
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByLabel('Rede ativa').selectOption('horizonte');
  await expect(page.getByLabel('Rede ativa')).toHaveValue('aurora');
  await expect(page.getByRole('textbox', { name: 'S · Subjetivo', exact: true })).toHaveValue(
    'Texto fictício ainda não salvo.',
  );
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar e sair' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda da unidade', exact: true })).toBeVisible();
});
