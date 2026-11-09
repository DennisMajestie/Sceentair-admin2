import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

const SCREENS: Array<{ path: string; heading: RegExp }> = [
  { path: '/dashboard/overview', heading: /dashboard|overview/i },
  { path: '/products/catalog', heading: /catalog/i },
  { path: '/orders/all', heading: /orders/i },
  { path: '/orders/returns', heading: /returns/i },
  { path: '/production', heading: /production/i },
  { path: '/production/tech-packs', heading: /tech packs/i },
  { path: '/purchasing/materials', heading: /materials/i },
  { path: '/warehouses/inventory', heading: /inventory/i },
  { path: '/warehouses/counts', heading: /counts/i },
  { path: '/warehouses/locations', heading: /stock|locations/i },
  { path: '/deliveries', heading: /deliver/i },
  { path: '/accounting/ledger', heading: /ledger/i },
  { path: '/approvals', heading: /approval/i },
  { path: '/audit/log', heading: /audit/i },
  { path: '/coupons/wallet', heading: /coupon/i },
  { path: '/marketing/campaigns', heading: /campaign/i },
  { path: '/partners', heading: /partner/i },
  { path: '/wholesale/tiers', heading: /tier|wholesale/i },
  { path: '/customers/shoppers', heading: /shoppers|customers/i },
  { path: '/customers/stockists', heading: /stockists/i },
  { path: '/settings/team', heading: /team|staff/i },
  { path: '/help/center', heading: /help|center/i },
];

test.describe('primary navigation smoke', () => {
  for (const screen of SCREENS) {
    test(`renders ${screen.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      await mockBackend(page);
      await page.goto(screen.path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(
        decodeURIComponent(new URL(page.url()).pathname),
        `expected to stay on ${screen.path}`,
      ).toBe(screen.path);
      await expect(page.locator('app-error-boundary .fatal, .app-crash')).toHaveCount(0);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
