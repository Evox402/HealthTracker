import { expect, test, type Page } from '@playwright/test';
import { demoBackup } from './demo';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });

async function onboard(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  await page.getByRole('button', { name: 'Save and start' }).click();
  await expect(page.getByRole('link', { name: 'Log now' })).toBeVisible();
}

async function restoreDemo(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Backup file').setInputFiles({
    name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(demoBackup())),
  });
  await expect(page.getByText(/This replaces everything/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Replace data' }).click();
  await download; // safety copy of the previous data
  await expect(page.getByText('Backup restored')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).click();
}

test('first launch: disclaimer and targets, then Today', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Not medical advice')).toBeVisible();
  await onboard(page);
  await expect(page.getByText('No medication plan yet')).toBeVisible();
});

test('quick log a full slot in a handful of taps, with undo', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log now' }).click();
  // Auto-advance moves the cursor: type all vitals into one focused flow.
  await page.getByLabel('Systolic', { exact: true }).click();
  await page.keyboard.type('128');
  await page.keyboard.type('78');
  await page.keyboard.type('72');
  await page.keyboard.type('97');
  await page.keyboard.type('16');
  await expect(page.getByLabel('Resp.', { exact: true })).toHaveValue('16');
  await page.getByRole('button', { name: 'No symptoms' }).click();
  await page.getByRole('button', { name: /^Save .* log$/ }).click();

  await expect(page.getByText(/log saved/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Blood pressure.*128\/78/ })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /Blood pressure.*–/ })).toBeVisible();
});

test('a dangerous value shows the red-flag banner first', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log now' }).click();
  await page.getByLabel('HR', { exact: true }).fill('41');
  await page.getByRole('button', { name: /^Save .* log$/ }).click();
  const banner = page.getByRole('alert').filter({ hasText: 'Heart rate 41 bpm' });
  await expect(banner).toContainText('Contact your care team now');
  await banner.getByRole('button', { name: "I've informed the care team" }).click();
  await expect(banner).toBeHidden();
});

test('unusual values need a second tap', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log now' }).click();
  await page.getByLabel('HR', { exact: true }).fill('720');
  await expect(page.getByText('Check value')).toBeVisible();
  await page.getByRole('button', { name: /^Save .* log$/ }).click();
  await expect(page.getByText(/look unusual/)).toBeVisible();
  await page.getByRole('button', { name: 'Save anyway' }).click();
  await expect(page.getByText(/log saved/)).toBeVisible();
});

test('medication, regimen and dose checklist', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Regimen').click();
  await page.getByRole('link', { name: 'Medications' }).click();
  await page.getByRole('button', { name: 'Add medication' }).click();
  await page.getByLabel('Search the library').fill('biso');
  await page.getByRole('button', { name: /Bisoprolol/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('link', { name: 'Back to regimen' }).click();
  await page.getByRole('button', { name: 'Set regimen' }).click();
  for (const slot of ['Morning', 'Noon', 'Evening', 'Night']) await page.getByLabel(slot, { exact: true }).fill('5');
  await page.getByLabel(/Note/).fill('Started on ward');
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('table')).toContainText('5 mg');
  await expect(page.getByText('Approx. values, verify with your pharmacist')).toBeVisible();

  await nav(page, 'Today').click();
  await page.getByRole('link', { name: 'Log now' }).click();
  await page.getByRole('button', { name: 'All taken as planned' }).click();
  await expect(page.getByRole('button', { name: 'All doses taken' })).toBeVisible();
  await page.getByRole('button', { name: /^Save .* log$/ }).click();
  await expect(page.getByText(/logged at/)).toBeVisible();
});

test('restored demo data drives insights, trends and the doctor view', async ({ page }, info) => {
  await onboard(page);
  await restoreDemo(page);
  const shot = (name: string) => page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });

  await expect(page.getByText('Top insights')).toBeVisible();
  await shot('today');
  await nav(page, 'Insights').click();
  await expect(page.getByText(/Systolic BP above range in the Morning/).first()).toBeVisible();
  await expect(page.getByText(/bisoprolol 2.5 → 5 mg/i).first()).toBeVisible();
  await shot('insights');
  await nav(page, 'Trends').click();
  await expect(page.getByRole('img', { name: /Systolic/ })).toBeVisible();
  await shot('trends');
  await nav(page, 'Regimen').click();
  await shot('regimen');
  await nav(page, 'Doctor').click();
  await expect(page.getByText('Vitals & medication summary')).toBeVisible();
  await shot('doctor');
  await page.goto('./#/log/evening');
  await shot('quicklog');
});
