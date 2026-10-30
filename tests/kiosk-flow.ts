import { type Page } from '@playwright/test';

/** Parte da identificação já preenchida, ou da escolha de identificação no balcão. */
export async function reviewTicket(
  page: Page,
  options: { identified?: boolean; service?: string; preference?: string } = {},
) {
  if (options.identified)
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  if (options.service)
    await page.getByRole('radio', { name: options.service, exact: true }).check();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  if (options.preference) {
    await page.getByRole('radio', { name: 'Atendimento preferencial', exact: true }).check();
    await page
      .getByLabel('Motivo da preferência', { exact: true })
      .selectOption(options.preference);
  }
  await page.getByRole('button', { name: 'Conferir minha senha', exact: true }).click();
}
