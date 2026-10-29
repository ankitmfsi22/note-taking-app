import { PASSWORD, createAccount, loginUser, uniqueEmail } from '../support/auth';
import { expect, test } from '../support/fixtures';
import { readLatestOtp } from '../support/otp';

test('S-AB1016-02 reset the password with an OTP read from the test-only file', async ({
  browser,
}) => {
  const email = uniqueEmail();
  const newPassword = 'brand-new-pass-2';

  const signup = await browser.newContext();
  await createAccount(await signup.newPage(), email);
  await signup.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/reset-password/);

  await expect.poll(() => readLatestOtp(email).catch(() => '')).toMatch(/^\d{6}$/);
  const otp = await readLatestOtp(email);
  await page.getByLabel('6-digit code').fill(otp);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginUser(page, email, newPassword);
  await expect(page).toHaveURL(/\/notes/);

  const oldContext = await browser.newContext();
  const oldPage = await oldContext.newPage();
  await loginUser(oldPage, email, PASSWORD);
  await expect(oldPage.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await expect(oldPage).toHaveURL(/\/login/);
  await context.close();
  await oldContext.close();
});
