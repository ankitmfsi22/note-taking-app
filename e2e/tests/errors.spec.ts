import { createAccount, loginUser, registerUser, uniqueEmail } from '../support/auth';
import { expect, test } from '../support/fixtures';

test('S-AB1016-03 invalid login shows an error and creates no session', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail();
  const signup = await browser.newContext();
  await createAccount(await signup.newPage(), email);
  await signup.close();

  await loginUser(page, email, 'wrong-password-9');
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');

  await page.goto('/notes');
  await expect(page).toHaveURL(/\/login/);
});

test('S-AB1016-04 a revoked public link and a too-short password are rejected', async ({
  browser,
  page,
}) => {
  await registerUser(page, uniqueEmail());
  await page.getByRole('button', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  // The autosave PATCH goes out 2 s after the edit; sharing before it lands shows "Untitled note".
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.ok(),
  );
  await page.getByRole('textbox', { name: 'Title' }).fill('Shared then revoked');
  await saved;

  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = page.getByRole('list', { name: 'Share links' }).locator('code');
  const publicUrl = (await link.textContent()) ?? '';

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(publicUrl);
  await expect(visitorPage.getByRole('heading', { name: 'Shared then revoked' })).toBeVisible();

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

  // A 3-character password is rejected and creates no account.
  const shortEmail = uniqueEmail();
  const signup = await browser.newContext();
  const signupPage = await signup.newPage();
  await registerUser(signupPage, shortEmail, 'abc');
  // The shared schema rejects it in the form (the same rule the API answers with 400).
  await expect(signupPage.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
  await expect(signupPage.getByText(/8 characters/)).toBeVisible();
  await expect(signupPage).toHaveURL(/\/register/);
  await loginUser(signupPage, shortEmail, 'abc');
  await expect(signupPage.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await signup.close();
});
