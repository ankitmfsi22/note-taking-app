import { expect, test } from '../support/fixtures';

test('the home page loads and shows that the API is up through the Vite proxy', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Note App' })).toBeVisible();
  await expect(page.getByText('The API is up.')).toBeVisible();
});
