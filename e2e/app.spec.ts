import { expect, test, type Page } from '@playwright/test';
import { demoBackup, demoBackupV1 } from './demo';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });

async function onboard(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  await page.getByRole('button', { name: 'Save and start' }).click();
  await expect(page.getByRole('heading', { name: 'Trackers' })).toBeVisible();
}

async function restore(page: Page, backup: unknown) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Backup file').setInputFiles({
    name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText(/This replaces everything/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Replace data' }).click();
  await download; // safety copy of the previous data
  await expect(page.getByText('Backup restored')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).click();
}

test('first launch: disclaimer, optional targets, then Today', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Not medical advice')).toBeVisible();
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  await page.getByRole('button', { name: 'Skip, keep the defaults' }).click();
  await expect(page.getByText('No medications yet')).toBeVisible();
  for (const name of ['Blood pressure', 'Heart rate', 'Weight', 'Pain', 'Stool']) {
    await expect(page.getByRole('link', { name: `Log ${name}`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Log SpO₂' })).toHaveCount(0);
});

test('log blood pressure and weight from Today, with undo', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log Blood pressure', exact: true }).click();
  // Auto-advance moves the cursor from systolic to diastolic.
  await page.keyboard.type('128');
  await page.keyboard.type('78');
  await expect(page.getByLabel('Diastolic')).toHaveValue('78');
  await page.getByRole('button', { name: 'Save Blood pressure' }).click();
  await expect(page.getByText('Blood pressure saved')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Blood pressure: open chart/ }).locator('..')).toContainText('128/78');

  await page.getByRole('link', { name: 'Log Weight', exact: true }).click();
  await page.getByLabel('Weight').fill('82,4');
  await page.getByLabel('Note (optional)').fill('before breakfast');
  await page.getByRole('button', { name: 'Save Weight' }).click();
  await expect(page.getByText('Weight saved')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /^Weight: open chart/ }).locator('..')).toContainText('Nothing logged yet');
});

test('a dangerous value shows the red-flag banner first', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log Heart rate', exact: true }).click();
  await page.getByLabel('Heart rate').fill('41');
  await page.getByRole('button', { name: 'Save Heart rate' }).click();
  const banner = page.getByRole('alert').filter({ hasText: 'Heart rate 41 bpm' });
  await expect(banner).toContainText('Contact your care team now');
  await banner.getByRole('button', { name: "I've informed the care team" }).click();
  await expect(banner).toBeHidden();
});

test('unusual values need a second tap', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Log Heart rate', exact: true }).click();
  await page.getByLabel('Heart rate').fill('720');
  await expect(page.getByText('Check value')).toBeVisible();
  await page.getByRole('button', { name: 'Save Heart rate' }).click();
  await expect(page.getByText(/looks unusual/)).toBeVisible();
  await page.getByRole('button', { name: 'Save anyway' }).click();
  await expect(page.getByText('Heart rate saved')).toBeVisible();
});

test('create a custom tracker, log it and see it in Charts', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: '+ New tracker' }).click();
  await page.getByRole('button', { name: 'New tracker' }).click();
  await page.getByLabel('Name').fill('Night stool');
  await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Stool' }).click();
  await page.getByRole('button', { name: 'Add tracker' }).click();
  await expect(page.getByText('Night stool added')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).click();

  await page.getByRole('link', { name: 'Log Night stool', exact: true }).click();
  await page.getByRole('button', { name: 'Save Night stool' }).click();
  await expect(page.getByText('Choose a type first.')).toBeVisible();
  await page.getByRole('radio', { name: /^Type 4: Smooth/ }).click();
  await page.getByRole('button', { name: 'Save Night stool' }).click();
  await expect(page.getByText('Night stool saved')).toBeVisible();

  await page.getByRole('link', { name: /^Night stool, last Type 4/ }).click();
  await expect(page).toHaveURL(/#\/charts\/s\//);
  await expect(page.getByRole('img', { name: 'Night stool, Bristol type 1 to 7' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Night stool per day' })).toBeVisible();
  await expect(page.getByText('Type 4 · Smooth').first()).toBeVisible();
});

test('med stack: add a medication, tick it off and undo', async ({ page }) => {
  await onboard(page);
  await nav(page, 'Meds').click();
  await page.getByRole('button', { name: 'Add medication' }).click();
  await page.getByLabel('Name').fill('Bisoprolol');
  for (const slot of ['Morning', 'Noon', 'Evening', 'Night']) await page.getByLabel(slot, { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Morning 5 mg · Noon 5 mg · Evening 5 mg · Night 5 mg')).toBeVisible();

  await nav(page, 'Today').click();
  const dose = page.getByRole('button', { name: /^Bisoprolol 5 mg: mark as taken/ });
  await dose.click();
  const taken = page.getByRole('button', { name: /^Bisoprolol 5 mg: Taken \d\d:\d\d, tap to undo/ });
  await expect(taken).toHaveAttribute('aria-pressed', 'true');
  await taken.click();
  await expect(dose).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'More options for Bisoprolol' }).click();
  await page.getByRole('button', { name: 'Skipped' }).click();
  await expect(page.getByRole('button', { name: /^Bisoprolol 5 mg: Skipped/ })).toBeVisible();
});

test('restored demo data drives Today, Charts, Meds and the doctor view', async ({ page }, info) => {
  await onboard(page);
  await restore(page, demoBackup());
  const shot = (name: string) => page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });

  await expect(page.getByRole('link', { name: 'Log Dizziness', exact: true })).toBeVisible();
  await shot('today');
  await nav(page, 'Charts').click();
  await expect(page.getByRole('img', { name: /Systolic/ })).toBeVisible();
  await page.getByRole('group', { name: 'Tracker' }).getByRole('button', { name: 'Stool', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Stool per day' })).toBeVisible();
  await shot('charts-stool');
  await page.getByRole('group', { name: 'Tracker' }).getByRole('button', { name: 'Pain', exact: true }).click();
  await expect(page.getByRole('img', { name: /Pain, 0 to 10/ })).toBeVisible();
  await nav(page, 'Meds').click();
  await expect(page.getByText('Magnesium').first()).toBeVisible();
  await shot('meds');
  await nav(page, 'Doctor').click();
  await expect(page.getByText('Health summary')).toBeVisible();
  await expect(page.getByRole('cell', { name: /type 4: 3/ })).toBeVisible();
  await shot('doctor');
});

test('a v1 MedicineAdjuster backup is upgraded on restore', async ({ page }) => {
  await onboard(page);
  await restore(page, demoBackupV1());
  await expect(page.getByRole('link', { name: 'Log Weight', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log SpO₂', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Pain, last/ })).toBeVisible();
});
