import { type Page } from '@playwright/test';
import { loginUser, registerUser, uniqueEmail } from '../support/auth';
import { expect, test } from '../support/fixtures';

const TITLE = 'Quarterly plan';
const BODY = 'zebra migration strategy';
const TAG = 'work';

// Edits go out 2 s after the last keystroke (SDS 9.4), so wait for the autosave PATCH itself.
const fillNote = async (page: Page, title: string, body?: string) => {
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.ok(),
  );
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  if (body) {
    await page.getByLabel('Note content').click();
    await page.keyboard.type(body);
  }
  await saved;
};

test('S-AB1016-01 the full journey passes end to end', async ({ browser, page }) => {
  const email = uniqueEmail();

  // Register, log out, log in.
  await registerUser(page, email);
  await expect(page).toHaveURL(/\/notes/);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginUser(page, email);
  await expect(page).toHaveURL(/\/notes/);

  // A tag, then a note that is edited with autosave and tagged.
  await page.getByLabel('New tag name').fill(TAG);
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('group', { name: 'Filter by tag' })).toBeVisible();

  await page.getByRole('button', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  const noteUrl = page.url();
  await fillNote(page, TITLE, BODY);
  await page.getByRole('button', { name: 'Add tag' }).click();
  await page.getByRole('button', { name: TAG, exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${TAG}` })).toBeVisible();
  await page.getByRole('link', { name: 'Back to notes' }).click();

  // A second, untagged note proves the tag filter filters.
  await page.getByRole('button', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  await fillNote(page, 'Groceries');
  await page.getByRole('link', { name: 'Back to notes' }).click();
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();

  await page
    .getByRole('group', { name: 'Filter by tag' })
    .getByRole('button', { name: TAG })
    .click();
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeHidden();

  // Search shows the match highlighted as a <mark> text node.
  await page.goto('/notes');
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('zebra');
  await expect(page.locator('mark', { hasText: 'zebra' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(noteUrl);

  // Share, and open the link in a logged-out context.
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = page.getByRole('list', { name: 'Share links' }).locator('code');
  await expect(link).toBeVisible();
  const publicUrl = (await link.textContent()) ?? '';
  expect(publicUrl).toMatch(/\/s\/.+/);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(publicUrl);
  await expect(visitorPage.getByRole('heading', { name: TITLE })).toBeVisible();
  await expect(visitorPage.getByText(BODY)).toBeVisible();

  // Revoke, and the public link is now unavailable.
  await page.getByRole('button', { name: 'Revoke', exact: true }).click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Revoke this link?' })
    .getByRole('button', { name: 'Revoke link' })
    .click();
  await expect(page.getByText('revoked')).toBeVisible();
  await visitorPage.reload();
  await expect(
    visitorPage.getByRole('heading', { name: 'This link is not available' }),
  ).toBeVisible();
  await visitor.close();
  await page.getByRole('button', { name: 'Close' }).click();

  // Edit again, then restore the version from before that edit through the history drawer.
  await fillNote(page, `${TITLE} v2`);
  await page.getByRole('button', { name: 'Version history' }).click();
  const versions = page.getByRole('list', { name: 'Versions' }).getByRole('button');
  const topBefore = (await versions.first().textContent()) ?? '';
  const count = await versions.count();
  await versions.nth(1).click();
  await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore this version' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(versions).toHaveCount(count + 1);
  await expect(versions.first()).not.toHaveText(topBefore);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(TITLE);
  await expect(page.getByText(BODY)).toBeVisible();

  // Delete the note, restore it from Trash, log out.
  await page.getByRole('link', { name: 'Back to notes' }).click();
  await page.getByRole('button', { name: `Delete ${TITLE}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByRole('heading', { name: TITLE })).toBeHidden();

  await page.getByRole('link', { name: 'Trash' }).click();
  await page.getByRole('button', { name: `Restore ${TITLE}` }).click();
  await expect(page.getByRole('button', { name: `Restore ${TITLE}` })).toBeHidden();
  await page.goto('/notes');
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
});
