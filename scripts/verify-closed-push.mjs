// Teste opt-in em um perfil descartável do navegador, com a rede real de Web Push.
import { chromium, firefox, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
const origin = process.env.CUIDELO_LIVE_ORIGIN || 'https://cuidelo.vercel.app';
const folder = await mkdtemp(join(tmpdir(), 'cuidelo-closed-push-'));
const channel = process.env.CUIDELO_BROWSER || 'chrome';
const engine = channel === 'firefox' ? firefox : chromium;
const ctx = await engine.launchPersistentContext(folder, {
  ...(channel === 'firefox'
    ? {
        firefoxUserPrefs: {
          'dom.push.enabled': true,
          'dom.push.connection.enabled': true,
          'dom.push.alwaysConnect': true,
        },
      }
    : {
        channel,
        ignoreDefaultArgs: ['--disable-background-networking', '--disable-component-update'],
      }),
  headless: true,
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  viewport: { width: 390, height: 844 },
});
let enabled = false;
async function openPerson(page) {
  await page.goto(origin + '/cidadao');
  const person = page.getByRole('button', { name: /João Pedro/ });
  if (await person.isVisible()) await person.click();
  await page.getByRole('link', { name: 'Dia a dia', exact: true }).click();
  await page.getByRole('link', { name: 'Medicação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meus medicamentos' })).toBeVisible();
}
try {
  await ctx.grantPermissions(['notifications'], { origin });
  const page = await ctx.newPage();
  await openPerson(page);
  await page.getByRole('button', { name: 'Novo lembrete' }).click();
  await page.getByLabel('Nome do medicamento').fill('Teste fictício de entrega');
  const { hhmm, day } = await page.evaluate(() => {
    const d = new Date(Date.now() + 150000);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      hhmm: [d.getHours(), d.getMinutes()].map(pad).join(':'),
      day: [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-'),
    };
  });
  await page.getByLabel('Horários diários').fill(hhmm);
  await page.getByLabel('Último dia (opcional)').fill(day);
  await page.getByRole('button', { name: 'Salvar lembrete' }).click();
  await page.getByRole('button', { name: 'Ativar avisos do aparelho' }).click();
  await expect(page.getByRole('button', { name: 'Testar em 1 minuto' })).toBeVisible({
    timeout: 30000,
  });
  enabled = true;
  await page.getByRole('button', { name: 'Testar em 1 minuto' }).click();
  await expect(page.getByText(/Teste confirmado pelo servidor/)).toBeVisible();
  const probe = await ctx.newPage();
  await page.close();
  if (ctx.pages().some((p) => p.url().startsWith(origin + '/cidadao')))
    throw Error('Uma tela do app ainda está aberta.');
  console.log('Todas as telas do Cuidelo fechadas. Aguardando teste e horário do medicamento.');
  // Documento de imagem fora do escopo do worker. Não carrega a aplicação nem qualquer temporizador de avisos.
  await probe.goto(origin + '/citizen-icons/192.png');
  let previous = '',
    checked = 0;
  await expect
    .poll(
      async () => {
        if (Date.now() - checked > 25000) {
          checked = Date.now();
          const status = await probe
            .evaluate(async () => {
              const key = Object.keys(localStorage).find((k) => k.startsWith('cuidelo.push.v1.'));
              if (!key) return 'sem perfil';
              const { owner } = JSON.parse(localStorage.getItem(key));
              const r = await fetch('/api/care-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + owner },
                body: JSON.stringify({ op: 'status' }),
                signal: AbortSignal.timeout(10000),
              });
              if (!r.ok) return String(r.status);
              const { nextAt, testAt, acceptedAt } = await r.json();
              return JSON.stringify({ nextAt, testAt, acceptedAt });
            })
            .catch(() => 'leitura indisponível');
          if (previous !== status) console.log('Agenda no servidor', status);
          previous = status;
        }
        return probe.evaluate(async () => {
          const cache = await caches.open('cuidelo-push-receipts-v1');
          const keys = await cache.keys();
          const receipts = await Promise.all(
            keys.map(async (k) => (await (await cache.match(k)).json()).kind),
          );
          return [...new Set(receipts)].sort();
        });
      },
      { timeout: 240000, intervals: [3000, 5000] },
    )
    .toEqual(['reminder', 'test']);
  console.log(
    'AVISOS APRESENTADOS: teste de um minuto e horário real de medicação, ambos sem página do app.',
  );
} finally {
  try {
    if (enabled) {
      const cleanup = await ctx.newPage();
      await openPerson(cleanup);
      try {
        await cleanup.getByRole('button', { name: 'Desativar avisos' }).click();
        await expect(
          cleanup.getByRole('button', { name: 'Ativar avisos do aparelho' }),
        ).toBeVisible({
          timeout: 30000,
        });
      } finally {
        await cleanup.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration('/cidadao/');
          await (await reg?.pushManager.getSubscription())?.unsubscribe();
        });
      }
    }
  } finally {
    await ctx.close();
    if (
      dirname(resolve(folder)) === resolve(tmpdir()) &&
      basename(folder).startsWith('cuidelo-closed-push-')
    )
      await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}
