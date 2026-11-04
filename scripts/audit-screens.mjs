// Percorre as telas com sessões fictícias isoladas. A pasta de evidências é opcional.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const origin = process.env.CUIDELO_AUDIT_ORIGIN || 'http://127.0.0.1:43318';
const output = process.env.CUIDELO_AUDIT_DIR;
const inventory = JSON.parse(
  await readFile(new URL('../src/data/pulso-inventory.json', import.meta.url), 'utf8'),
);
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
const records = [],
  errors = [];
const roles = [
  'manager',
  'reception',
  'clinical',
  'nursing',
  'pharmacy',
  'regulation',
  'admin',
  'acs',
  'business',
];
const capture = {
  public: ['/acesso', '/cidadao', '/apresentacao'],
  manager: ['/', '/integracoes'],
  reception: ['/', '/recepcao', '/agenda', '/acesso'],
  clinical: ['/consultorio', '/atendimento/aurora-centro-e0', '/escuta', '/pessoas/aurora-p1'],
  pharmacy: ['/farmacia'],
  acs: ['/modulos'],
  business: ['/modulos'],
};
async function inspect(page, role, path, width) {
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.locator('main, h1, .tv-display, .app-error').first().waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  const measure = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const visible = (e) =>
      e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const unnamed = [...main.querySelectorAll('button,input:not([type=hidden]),select,textarea')]
      .filter(visible)
      .filter(
        (e) =>
          !(
            e.getAttribute('aria-label') ||
            e.getAttribute('aria-labelledby') ||
            e.labels?.length ||
            e.innerText?.trim() ||
            e.title ||
            e.getAttribute('placeholder')
          ),
      )
      .map((e) => e.outerHTML.slice(0, 160));
    return {
      title: main.querySelector('h1')?.textContent ?? main.querySelector('h2')?.textContent ?? '',
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      start: Math.round(main.getBoundingClientRect().top),
      unnamed,
      denied:
        /Página não encontrada|Não foi possível abrir esta tela|Este módulo não faz parte do perfil|Módulo indisponível nesta sessão|Painel indisponível nesta sessão/.test(
          main.innerText,
        ),
    };
  });
  records.push({ role, path, width, ...measure });
  if (
    output &&
    (capture[role]?.includes(path) ||
      [
        '/totem?rede=aurora&unidade=aurora-centro',
        '/painel?rede=aurora&unidade=aurora-centro',
        '/cidadao/dia-a-dia/orientacoes',
      ].includes(path))
  )
    await page.screenshot({
      path: join(
        output,
        role +
          '-' +
          (path.replace(/[^a-z0-9]+/gi, '-').slice(1) || 'inicio') +
          '-' +
          width +
          '.png',
      ),
      animations: 'disabled',
    });
}
async function roleAudit(role) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }),
    page = await ctx.newPage();
  page.on('pageerror', (e) =>
    errors.push({ role, path: new URL(page.url()).pathname, error: e.message }),
  );
  try {
    await page.goto(origin + '/acesso');
    await page.locator('[data-role="' + role + '"]').click();
    await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
    await page.goto(origin + '/modulos');
    await page.locator('main h1').waitFor();
    const links = await page
      .locator('nav a,main a')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')).filter((s) => s?.startsWith('/')),
      );
    const paths = new Set(['/', ...links]);
    if (role === 'clinical')
      for (const p of [
        '/atendimento/aurora-centro-e0',
        '/escuta/aurora-centro-e0',
        '/pessoas/aurora-p1',
      ])
        paths.add(p);
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      for (const path of paths) await inspect(page, role, path, width);
    }
    if (role === 'admin' || role === 'clinical') {
      for (const unit of ['aurora-upa', 'aurora-hospital']) {
        await page.goto(origin + '/acesso');
        await page.locator('[data-role="' + role + '"]').click();
        await page.getByLabel('Unidade da sessão', { exact: true }).selectOption(unit);
        await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
        for (const width of [1440, 360]) {
          await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
          for (const route of [
            '/',
            '/recepcao',
            '/fila',
            '/hospital',
            role === 'clinical' ? '/consultorio' : '/vacinacao-rede',
          ])
            await inspect(page, role + '@' + unit, route, width);
        }
      }
    }
  } finally {
    await ctx.close();
  }
}
try {
  for (let i = 0; i < roles.length; i += 3) await Promise.all(roles.slice(i, i + 3).map(roleAudit));
  const page = await browser.newPage();
  page.on('pageerror', (e) =>
    errors.push({ role: 'public', path: new URL(page.url()).pathname, error: e.message }),
  );
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
    for (const p of [
      '/apresentacao',
      '/acesso',
      '/totem?rede=aurora&unidade=aurora-centro',
      '/painel?rede=aurora&unidade=aurora-centro',
      '/tv',
      '/cidadao',
    ])
      await inspect(page, 'public', p, width);
    const person = page.getByRole('button', { name: /Ana Clara/ });
    if (await person.isVisible()) await person.click();
    for (const p of [
      '/cidadao/',
      '/cidadao/agenda',
      '/cidadao/documentos',
      '/cidadao/dia-a-dia',
      '/cidadao/dia-a-dia/diario',
      '/cidadao/dia-a-dia/medicacao',
      '/cidadao/dia-a-dia/relatorio',
      '/cidadao/dia-a-dia/orientacoes',
    ])
      await inspect(page, 'public', p, width);
    await page.getByRole('button', { name: 'Sair do app do cidadão' }).click();
  }
  const routes = new Set(records.map((r) => r.path)),
    missing = inventory.rows.filter((r) => !routes.has(r.route)).map((r) => r.id);
  const findings = records.filter((r) => r.denied || r.overflow > 1 || r.unnamed.length);
  if (output)
    await writeFile(
      join(output, 'telas.json'),
      JSON.stringify({ records, errors, missing }, null, 2),
    );
  console.log(
    JSON.stringify(
      {
        checks: records.length,
        routes: routes.size,
        profiles: roles.length,
        missing,
        errors,
        issues: findings.length,
        examples: findings.slice(0, 8),
      },
      null,
      2,
    ),
  );
  if (missing.length || errors.length || findings.length) process.exitCode = 1;
} finally {
  await browser.close();
}
