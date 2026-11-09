import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

const SCREENS: Array<{ path: string; heading: RegExp }> = [
  { path: '/dashboard/overview', heading: /dashboard|overview/i },
  { path: '/dashboard/activity', heading: /activity/i },
  { path: '/dashboard/alerts', heading: /alerts/i },
  { path: '/products/catalog', heading: /catalog/i },
  { path: '/products/item/p-tee', heading: /crab tee/i },
  { path: '/products/batches/p-tee', heading: /batches/i },
  { path: '/products/reviews', heading: /review moderation/i },
  { path: '/orders/all', heading: /orders/i },
  { path: '/orders/all/o-1', heading: /all orders/i },
  { path: '/orders/board', heading: /board|orders/i },
  { path: '/orders/returns', heading: /returns/i },
  { path: '/orders/returns/r-1', heading: /returns/i },
  { path: '/messages', heading: /messages/i },
  { path: '/orders/custom', heading: /custom orders/i },
  { path: '/orders/custom/co-1', heading: /custom orders/i },
  { path: '/production', heading: /production/i },
  { path: '/production/pb-1', heading: /production/i },
  { path: '/production/tech-packs', heading: /tech packs/i },
  { path: '/production/tech-packs/tp-1', heading: /tech packs/i },
  { path: '/production/kiosk', heading: /production line/i },
  { path: '/purchasing/orders', heading: /material purchases/i },
  { path: '/purchasing/orders/po-1', heading: /material purchases/i },
  { path: '/purchasing/materials', heading: /materials/i },
  { path: '/purchasing/materials/m-shea', heading: /materials/i },
  { path: '/purchasing/suppliers', heading: /suppliers/i },
  { path: '/purchasing/suppliers/s-1', heading: /suppliers/i },
  { path: '/warehouses/inventory', heading: /inventory/i },
  { path: '/warehouses/inventory/variant/v-crb15-15', heading: /inventory/i },
  { path: '/warehouses/counts', heading: /counts/i },
  { path: '/warehouses/counts/c-1', heading: /counts/i },
  { path: '/warehouses/locations', heading: /stock|locations/i },
  { path: '/warehouses/locations/wh-1', heading: /stock|locations/i },
  { path: '/deliveries', heading: /deliver/i },
  { path: '/deliveries/d-1', heading: /deliver/i },
  { path: '/accounting/ledger', heading: /ledger/i },
  { path: '/accounting/ledger/ae-1', heading: /ledger/i },
  { path: '/approvals', heading: /approval/i },
  { path: '/approvals/apr-1', heading: /approval/i },
  { path: '/audit/log', heading: /audit/i },
  { path: '/audit/log/al-1', heading: /audit/i },
  { path: '/coupons/wallet', heading: /coupon/i },
  { path: '/coupons/campaigns', heading: /coupon campaigns/i },
  { path: '/media', heading: /media/i },
  { path: '/media/media-1', heading: /media/i },
  { path: '/marketing/campaigns', heading: /campaign/i },
  { path: '/marketing/campaigns/mc-1', heading: /campaign/i },
  { path: '/partners', heading: /partner/i },
  { path: '/partners/p-1', heading: /partner/i },
  { path: '/wholesale/accounts', heading: /wholesale accounts/i },
  { path: '/wholesale/accounts/w-1', heading: /wholesale accounts/i },
  { path: '/wholesale/tiers', heading: /tier|wholesale/i },
  { path: '/customers/shoppers', heading: /shoppers|customers/i },
  { path: '/customers/shoppers/cus-1', heading: /shoppers/i },
  { path: '/customers/stockists', heading: /stockists/i },
  { path: '/customers/stockists/cus-1', heading: /stockists/i },
  { path: '/analytics/overview', heading: /report|overview/i },
  { path: '/analytics/sales', heading: /sales/i },
  { path: '/analytics/stock', heading: /stock/i },
  { path: '/settings/account', heading: /account/i },
  { path: '/settings/company', heading: /company/i },
  { path: '/settings/notifications', heading: /notifications/i },
  { path: '/settings/team', heading: /team|staff/i },
  { path: '/settings/security', heading: /security/i },
  { path: '/help/center', heading: /help|center/i },
  { path: '/help/tickets', heading: /tickets/i },
];

test.describe('primary navigation smoke', () => {
  for (const screen of SCREENS) {
    test(`renders ${screen.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      await mockBackend(page);
      await page.goto(screen.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first({ timeout: 30_000 })).toBeVisible({ timeout: 30_000 });
      expect(
        decodeURIComponent(new URL(page.url()).pathname),
        `expected to stay on ${screen.path}`,
      ).toBe(screen.path);
      await expect(page.locator('app-error-boundary .fatal, .app-crash')).toHaveCount(0);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
