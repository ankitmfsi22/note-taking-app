import { createAccount, loginUser, uniqueEmail } from '../support/auth';
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
