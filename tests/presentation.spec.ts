import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const portable of [false, true]) {
  test(
    'roteiro preserva o acesso explícito e a navegação · ' + (portable ? 'HTML offline' : 'web'),
    async ({ page, context }) => {
      if (portable) await context.setOffline(true);
      const base = portable
        ? pathToFileURL(resolve('dist-standalone/Cuidelo.html')).href + '#'
        : '';
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(base + '/apresentacao');
      const before = page.url();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Toda a rede.');
      expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.entry.v1'))).toBeNull();
      await page.getByRole('link', { name: 'Começar a demonstração' }).click();
      expect(page.url()).toBe(before);
      await expect(page.locator('#roteiro')).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      const cards = page.locator('.presentation-card');
      await cards.filter({ hasText: 'A visão da prefeitura' }).getByRole('link').click();
      await expect(page.locator('[data-role="manager"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.entry.v1'))).toBeNull();
      await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
      await expect(page.getByRole('heading', { name: 'Visão da rede' })).toBeVisible();
      const session = await page.evaluate(() => localStorage.getItem('cuidelo.demo.entry.v1'));
      await page.goto(base + '/apresentacao');
      expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.entry.v1'))).toBe(
        session,
      );
      await cards.filter({ hasText: 'Chegada e acolhimento' }).getByRole('link').click();
      await expect(page.locator('[data-role="reception"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => localStorage.getItem('cuidelo.demo.entry.v1'))).toBe(
        session,
      );
      await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
      await expect(
        page.getByRole('heading', { name: 'Recepção e atendimento', exact: true }),
      ).toBeVisible();
    },
  );
}
