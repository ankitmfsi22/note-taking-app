import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { registerUser, uniqueEmail } from '../support/auth';
import { expect, test } from '../support/fixtures';

// WCAG 2.0 and 2.1, levels A and AA, in real Chromium (so colour contrast is checked too).
const violationsOn = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
};

test('S-AB1016-22 browsers pass axe on the real pages', async ({ browser, page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(await violationsOn(page)).toEqual([]);

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  expect(await violationsOn(page)).toEqual([]);

  await registerUser(page, uniqueEmail());
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  expect(await violationsOn(page)).toEqual([]);

  await page.getByRole('button', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.ok(),
  );
  await page.getByRole('textbox', { name: 'Title' }).fill('Accessible note');
  await saved;
  await expect(page.getByRole('toolbar')).toBeVisible();
  expect(await violationsOn(page)).toEqual([]);

  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = page.getByRole('list', { name: 'Share links' }).locator('code');
  const publicUrl = (await link.textContent()) ?? '';
  // The open dialog is part of the page: it must pass too.
  expect(await violationsOn(page)).toEqual([]);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(publicUrl);
  await expect(visitorPage.getByRole('heading', { name: 'Accessible note' })).toBeVisible();
  expect(await violationsOn(visitorPage)).toEqual([]);
  await visitor.close();
});
