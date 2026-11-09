import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

const sessionExpired = { message: 'Session expired.' };

const noSessionRules = [
  { method: 'POST', match: /\/auth\/refresh$/, status: 401, data: sessionExpired },
];

test('unauthenticated deep link to the admin redirects to sign-in', async ({ page }) => {
  await mockBackend(page, noSessionRules);
  await page.goto('/warehouses/inventory');
  await page.waitForURL('**/signin**');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('sign-in posts credentials and lands on the dashboard', async ({ page }) => {
  const session = await mockBackend(page, noSessionRules);
  await page.goto('/signin');
  await page.locator('input[name="email"]').fill('admin@vessa.test');
  await page.locator('input[name="password"]').fill('correct-horse-battery');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.waitForURL('**/dashboard/overview');
  const login = session.posts.find((post) => post.path === '/auth/login');
  expect(login).toBeTruthy();
  expect(login?.body).toMatchObject({ email: 'admin@vessa.test', password: 'correct-horse-battery' });
  await expect(page.getByRole('heading', { name: 'Welcome back, Adebayo!' })).toBeVisible();
});

test('bad credentials keep the user on the sign-in page with an error', async ({ page }) => {
  await mockBackend(page, [
    ...noSessionRules,
    {
      method: 'POST',
      match: /\/auth\/login$/,
      status: 401,
      data: { message: 'Invalid credentials.' },
    },
  ]);
  await page.goto('/signin');
  await page.locator('input[name="email"]').fill('admin@vessa.test');
  await page.locator('input[name="password"]').fill('wrong-password');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.locator('.form-err')).toContainText('Sign-in failed');
  expect(page.url()).toContain('/signin');
});
