import { expect, type Page } from '@playwright/test';
export async function selectSession(
  page: Page,
  patch: { organizationId?: string; unitId?: string; role?: string; second?: boolean },
) {
  const current = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('cuidelo.demo.context.v1') ||
        '{"organizationId":"aurora","unitId":"all","role":"manager"}',
    ),
  );
  const organizationId = patch.organizationId ?? current.organizationId;
  const unitId =
    patch.unitId ??
    (patch.organizationId && patch.organizationId !== current.organizationId
      ? `${organizationId}-centro`
      : current.unitId === 'all'
        ? 'aurora-centro'
        : current.unitId);
  const role = patch.role ?? (current.role === 'manager' ? 'admin' : current.role);
  const previous = new URL(page.url()),
    portable = previous.protocol === 'file:';
  const path = portable ? previous.hash.slice(1) || '/' : previous.pathname + previous.search;
  const url = (route: string) =>
    portable ? previous.href.split('#')[0] + '#' + route : previous.origin + route;
  await page.goto(url('/acesso'));
  if (role !== 'business') {
    await page
      .getByLabel('Prefeitura de demonstração', { exact: true })
      .selectOption(organizationId);
    await page.getByLabel('Unidade da sessão', { exact: true }).selectOption(unitId);
  }
  const sessionId =
    role === 'business'
      ? 'office:business'
      : role === 'manager'
        ? `${organizationId}:manager`
        : `${unitId}:${role}${patch.second ? ':2' : ''}`;
  await page.locator(`[data-session="${sessionId}"]`).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('cuidelo.demo.context.v1') || '{}').sessionId,
      ),
    )
    .toBe(sessionId);
  await page.goto(url(path));
}
