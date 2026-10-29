import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const PASSWORD = 'correct-horse-1';

let counter = 0;
// Each test registers its own user, so tests never share data (AC-E2E-04).
export const uniqueEmail = (): string => `e2e-${Date.now()}-${counter++}@example.com`;

export const registerUser = async (page: Page, email: string, password = PASSWORD) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
};

export const loginUser = async (page: Page, email: string, password = PASSWORD) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

// Registers through the UI, then drops the session so the next step starts logged out.
export const createAccount = async (page: Page, email: string, password = PASSWORD) => {
  await registerUser(page, email, password);
  await expect(page).toHaveURL(/\/notes/);
  await page.context().clearCookies();
  await page.evaluate(() => window.sessionStorage.clear());
};
