import { test, expect } from '@playwright/test';
import { selectSession } from './session';
import { freshDiary, applyCare, careKey, type CareScope } from '../src/domain/citizen-care';
import { readCitizenExample } from '../src/data/citizen-examples';

const origin = process.env.CUIDELO_REPORT_TEST_ORIGIN || 'http://127.0.0.1:43173';
test('celular compartilha cinco tipos de registro com outro navegador, confere paciente e encerra', async ({
  browser,
  page,
}) => {
  test.setTimeout(95000);
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: 'America/Sao_Paulo',
      locale: 'pt-BR',
    }),
    phone = await mobile.newPage();
  let issued = false;
  try {
    await phone.goto(origin + '/cidadao');
    await phone.getByRole('button', { name: /Ana Clara/ }).click();
    await phone.goto(origin + '/cidadao/dia-a-dia/relatorio');
    await expect(phone.locator('.care-report')).toBeVisible();
    const day = await phone.evaluate(() => new Intl.DateTimeFormat('sv-SE').format(new Date()));
    const at = new Date(day + 'T06:01:00-03:00'),
      view = readCitizenExample('ana', at),
      diary = freshDiary(),
      scope: CareScope = { role: 'citizen', unit: 'personal', ...view.careScope };
    applyCare(
      scope,
      diary,
      {
        type: 'entry',
        kind: 'crisis',
        at: day + 'T00:00',
        condition: 'Condição de demonstração',
        duration: '12',
        intensity: 'Moderada',
        text: 'Relato de crise para a consulta.',
      },
      view,
      at,
    );
    applyCare(
      scope,
      diary,
      {
        type: 'plan',
        medicine: 'Medicamento fictício do relatório',
        condition: '',
        times: ['00:00'],
        start: day,
        end: '',
        source: null,
        advance: 0,
        pickup: day,
        renewal: day,
      },
      view,
      at,
    );
    const planId = diary.plans[0].id;
    applyCare(
      scope,
      diary,
      {
        type: 'respond',
        action: 'later',
        minutes: 10,
        noticeId: 'b'.repeat(32),
        zone: 'America/Sao_Paulo',
        due: at.getTime(),
        target: { planId, kind: 'dose', when: day + 'T00:00' },
      },
      view,
      at,
    );
    applyCare(scope, diary, { type: 'dose', planId, slot: day + 'T00:00', taken: true }, view, at);
    for (const kind of ['pickup', 'renewal'] as const)
      applyCare(scope, diary, { type: 'step', planId, kind, date: day, next: '' }, view, at);
    await phone.evaluate(
      async ({ diary, key }) => {
        const db = await new Promise<IDBDatabase>((yes) => {
          const r = indexedDB.open('cuidelo.citizen.care.v1');
          r.onsuccess = () => yes(r.result);
        });
        await new Promise<void>((yes, no) => {
          const tx = db.transaction('journals', 'readwrite');
          tx.objectStore('journals').put(diary, key);
          tx.oncomplete = () => yes();
          tx.onabort = () => no(tx.error);
        });
        db.close();
      },
      { diary, key: careKey(scope) },
    );
    await phone.reload();
    await phone.getByLabel('De', { exact: true }).fill(day);
    await phone.getByRole('button', { name: 'Compartilhar relatório', exact: true }).click();
    await phone.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(phone.getByLabel('Código do relatório')).toHaveCount(0);
    await phone.getByRole('button', { name: 'Compartilhar relatório', exact: true }).click();
    const wire = phone.waitForRequest(
      (r) => r.url().endsWith('/api/cidadao') && r.postDataJSON()?.op === 'report.create',
    );
    await phone.getByRole('button', { name: 'Autorizar e gerar código' }).click();
    expect((await wire).postData()).not.toMatch(
      /Martins|Moderada|Medicamento|Relato de crise|aurora/,
    );
    const field = phone.getByLabel('Código do relatório');
    await expect(field).toBeVisible({ timeout: 25000 });
    issued = true;
    const code = await field.inputValue();
    expect(code.split('-')).toHaveLength(6);
    await phone.reload();
    await expect(field).toHaveValue(code);
    const encounter = origin + '/atendimento/aurora-centro-';
    await page.goto(encounter + 'e1');
    await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
    const open = async () => {
      await page.getByRole('button', { name: 'Abrir relatório com código' }).click();
      await page.getByLabel('Código compartilhado pela pessoa').fill(code);
      await page.getByRole('button', { name: 'Consultar relatório' }).click();
    };
    await open();
    await expect(page.getByText(/código não corresponde ao paciente/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('Relato de crise para a consulta.', { exact: false })).toHaveCount(
      0,
    );
    await page.goto(encounter + 'e0');
    await open();
    const report = page.locator('.consultation-report .care-report');
    await expect(report).toBeVisible({ timeout: 20000 });
    for (const text of [
      'Relato de crise para a consulta.',
      'Informou que tomou',
      'Aviso adiado',
      'Retirada · Medicamento fictício',
      'Renovação · Medicamento fictício',
      'Relato pessoal',
    ])
      await expect(report).toContainText(text);
    await page.reload();
    await expect(report).toContainText('Aviso adiado', { timeout: 20000 });
    await page.getByRole('button', { name: 'Pessoa entrou · iniciar' }).click();
    await page.getByRole('button', { name: 'Registrar revisão no prontuário' }).click();
    const guidance = page.getByLabel('Orientação para a pessoa');
    await guidance.fill('Levar o diário à próxima consulta de demonstração.');
    await page.getByRole('button', { name: 'Registrar e enviar orientação' }).click();
    await expect(
      page.getByText('Envio confirmado para o app do cidadão.', { exact: true }),
    ).toBeVisible({ timeout: 25000 });
    await phone.getByRole('link', { name: 'Orientações', exact: true }).click();
    await expect(
      phone.getByText('Levar o diário à próxima consulta de demonstração.', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByText('Aguardando confirmação de leitura', { exact: true }),
    ).toBeVisible();
    await phone.getByRole('button', { name: 'Confirmar que li', exact: true }).click();
    await expect(page.locator('.report-history').getByText(/Leitura confirmada em/)).toHaveCount(
      1,
      { timeout: 20000 },
    );
    await phone.reload();
    await expect(phone.getByText(/Leitura confirmada em/)).toBeVisible();
    // Perde só a resposta: o servidor recebeu, mas a estação deve manter o envio pendente até conferir.
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const response = await original(input, init);
        if (
          typeof init?.body === 'string' &&
          String(input).endsWith('/api/cidadao') &&
          JSON.parse(init.body).op === 'report.reply'
        ) {
          window.fetch = original;
          document.documentElement.dataset.replyStatus = String(response.status);
          if (response.ok) throw new TypeError('Simulação de resposta perdida após o aceite.');
        }
        return response;
      };
    });
    await guidance.fill('Segunda orientação fictícia para o retorno.');
    await page.getByRole('button', { name: 'Registrar e enviar orientação' }).click();
    await expect(page.getByRole('button', { name: 'Tentar enviar novamente' })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.locator('html')).toHaveAttribute('data-reply-status', /^(200|201)$/);
    await phone.getByRole('link', { name: 'Relatório', exact: true }).click();
    await phone.getByRole('button', { name: 'Encerrar compartilhamento' }).click();
    await expect(field).toHaveCount(0);
    issued = false;
    await expect(report).toHaveCount(0, { timeout: 17000 });
    await expect(page.getByText(/código expirou, foi encerrado/i)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Tentar enviar novamente' }).click();
    await expect(
      page.getByText('Envio confirmado para o app do cidadão.', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await phone.goto(origin + '/cidadao/dia-a-dia/orientacoes');
    await expect(
      phone.getByText('Segunda orientação fictícia para o retorno.', { exact: true }),
    ).toHaveCount(1, { timeout: 25000 });
    await expect(
      page
        .locator('.report-history')
        .getByText('Aguardando confirmação de leitura', { exact: true }),
    ).toHaveCount(1);
    await phone.getByRole('button', { name: 'Confirmar que li', exact: true }).click();
    await expect(page.locator('.report-history').getByText(/Leitura confirmada em/)).toHaveCount(
      2,
      { timeout: 20000 },
    );
    await phone.getByRole('button', { name: 'Sair do app do cidadão' }).click();
    await phone.getByRole('button', { name: /João Pedro/ }).click();
    await phone.goto(origin + '/cidadao/dia-a-dia/orientacoes');
    await expect(phone.getByText('Nenhuma orientação recebida.', { exact: true })).toBeVisible();
    await expect(
      phone.getByText('Segunda orientação fictícia para o retorno.', { exact: true }),
    ).toHaveCount(0);
    await page.goto(origin + '/pessoas/aurora-p1');
    await expect(page.getByRole('heading', { name: 'Revisões do Dia a dia' })).toBeVisible();
    await expect(
      page.locator('.report-history').getByText('Relatório do Dia a dia revisado', { exact: true }),
    ).toHaveCount(1);
    await expect(
      page
        .locator('.report-history')
        .getByText('Segunda orientação fictícia para o retorno.', { exact: true }),
    ).toHaveCount(1);
    await page.goto(encounter + 'e0');
    await page.getByRole('button', { name: 'Abrir relatório com código' }).click();
    await page.getByLabel('Código compartilhado pela pessoa').fill(code);
    await page.getByRole('button', { name: 'Consultar relatório' }).click();
    await expect(page.getByText(/código expirou, foi encerrado/i)).toBeVisible({ timeout: 15000 });
  } finally {
    try {
      if (issued) {
        await phone.goto(origin + '/cidadao/dia-a-dia/relatorio');
        await phone.getByRole('button', { name: 'Encerrar compartilhamento' }).click();
        await expect(phone.getByLabel('Código do relatório')).toHaveCount(0);
      }
    } finally {
      await mobile.close();
    }
  }
});
test('link emitido pela unidade permite compartilhar com o médico em outra estação', async ({
  browser,
  page,
}) => {
  test.setTimeout(105000);
  const citizen = await browser.newContext({
      viewport: { width: 375, height: 812 },
      timezoneId: 'America/Sao_Paulo',
    }),
    mobile = await citizen.newPage();
  const station = await browser.newContext(),
    doctor = await station.newPage();
  let sent = false,
    issued = false;
  try {
    await page.goto(origin + '/pessoas/aurora-p1');
    await selectSession(page, { role: 'clinical', unitId: 'aurora-centro' });
    await page.getByRole('button', { name: 'Disponibilizar no celular' }).click();
    await page.getByRole('button', { name: 'Gerar link de demonstração' }).click();
    const source = page.getByLabel('Link de leitura para o celular');
    await expect(source).toBeVisible({ timeout: 25000 });
    issued = true;
    await mobile.goto(await source.inputValue());
    await mobile.getByRole('link', { name: 'Dia a dia', exact: true }).click();
    await mobile.getByRole('link', { name: 'Registrar crise ou sintoma' }).click();
    await mobile.getByLabel('Meu relato').fill('Relato fictício pelo vínculo da unidade.');
    await mobile.getByRole('button', { name: 'Salvar relato' }).click();
    await expect(mobile.locator('.care-timeline')).toContainText('pelo vínculo da unidade');
    await mobile.getByRole('link', { name: 'Relatório', exact: true }).click();
    await mobile.getByRole('button', { name: 'Compartilhar relatório', exact: true }).click();
    await mobile.getByRole('button', { name: 'Autorizar e gerar código' }).click();
    const field = mobile.getByLabel('Código do relatório');
    await expect(field).toBeVisible({ timeout: 25000 });
    sent = true;
    await doctor.goto(origin + '/atendimento/aurora-centro-e0');
    await selectSession(doctor, { role: 'clinical', second: true, unitId: 'aurora-centro' });
    await doctor.getByRole('button', { name: 'Abrir relatório com código' }).click();
    await doctor.getByLabel('Código compartilhado pela pessoa').fill(await field.inputValue());
    await doctor.getByRole('button', { name: 'Consultar relatório' }).click();
    await expect(doctor.locator('.consultation-report .care-report')).toContainText(
      'Relato fictício pelo vínculo da unidade.',
      { timeout: 20000 },
    );
    await doctor.getByRole('button', { name: 'Fechar relatório' }).click();
    await expect(doctor.locator('.consultation-report .care-report')).toHaveCount(0);
  } finally {
    try {
      if (sent) {
        await mobile.getByRole('button', { name: 'Encerrar compartilhamento' }).click();
        await expect(mobile.getByLabel('Código do relatório')).toHaveCount(0);
      }
      if (issued) {
        await page.getByRole('button', { name: 'Encerrar link' }).click();
        await expect(page.getByLabel('Link de leitura para o celular')).toHaveCount(0);
      }
    } finally {
      await citizen.close();
      await station.close();
    }
  }
});
