import { expect, test } from '@playwright/test';
import { mockBackend, type MockSession } from './support/mock-backend';

let session: MockSession;

test.describe('inventory ledger journeys', () => {
  test.beforeEach(async ({ page }) => {
    session = await mockBackend(page);
  });

  test('unified list shows labelled rows, net movement history and values', async ({ page }) => {
    await page.goto('/warehouses/inventory');

    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CRB15-M-NAVY' })).toBeVisible();
    await expect(page.getByText('Shea butter')).toBeVisible();
    await expect(page.getByText('Purchase +700, Sale −88')).toBeVisible();
    await expect(page.getByText('₦2,570,400').first()).toBeVisible();

    const cells = page.locator('tbody td.num');
    await expect(cells).toHaveCount(4);
  });

  test('check ledger reveals hash-chain integrity', async ({ page }) => {
    await page.goto('/warehouses/inventory');
    await page.getByRole('button', { name: 'Check ledger' }).click();
    await expect(page.getByText('Ledger verified: 24 of 24 entries intact.')).toBeVisible();
    await expect(page.getByText(/Latest entry fingerprint: abcdef0123456789/)).toBeVisible();
  });

  test('type filter narrows to raw materials only', async ({ page }) => {
    await page.goto('/warehouses/inventory');
    await page.getByRole('button', { name: /Raw materials/ }).click();
    await expect(page.getByRole('link', { name: 'CRB15-M-NAVY' })).toHaveCount(0);
    await expect(page.getByText('Shea butter')).toBeVisible();
  });

  test('row opens the item detail with movement history', async ({ page }) => {
    await page.goto('/warehouses/inventory');
    await page.getByRole('link', { name: 'CRB15-M-NAVY' }).click();
    await page.waitForURL('**/warehouses/inventory/variant/v-crb15-15');

    await expect(page.getByRole('heading', { name: 'Movement history' })).toBeVisible();
    await expect(page.getByText('Production: +700 units (BATCH-1)')).toBeVisible();
    await expect(page.getByText('Sale: -88 units (ORD-77)')).toBeVisible();
    await expect(page.getByText('Product').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Record movement/ })).toBeVisible();
  });

  test('stock check digest renders ledger-chain facts', async ({ page }) => {
    await page.goto('/warehouses/inventory/variant/v-crb15-15');
    await page.getByRole('button', { name: 'Run stock check' }).click();
    await expect(page.getByRole('heading', { name: 'Stock check' })).toBeVisible();
    await expect(page.locator('.fp')).toHaveText('0123456789abcdef');
  });

  test('records an inbound adjustment to the ledger', async ({ page }) => {
    await page.goto('/warehouses/inventory/variant/v-crb15-15');

    await expect(page.getByText('In stock now')).toBeVisible();
    await page.getByLabel('Direction').selectOption('in');
    await page.getByLabel('Quantity').fill('10');
    await page.getByLabel('Reference').fill('cycle count fix');
    await page.getByRole('button', { name: 'Record movement' }).click();

    await expect(page.getByText('Movement recorded')).toBeVisible();
    const movement = session.posts.find(
      (post) => post.path.startsWith('/inventory/') && post.path.includes('/movements'),
    );
    expect(movement?.path).toBe('/inventory/v-crb15-15/movements');
    expect(movement?.body).toMatchObject({
      movementType: 'adjustment',
      quantityDelta: 10,
      referenceId: 'cycle count fix',
    });
  });

  test('routes stock removals through the stock_disposal approval flow', async ({ page }) => {
    await page.goto('/warehouses/inventory/variant/v-crb15-15');

    await page.getByLabel('Direction').selectOption('out');
    await page.getByLabel('Quantity').fill('3');
    await page.getByLabel('Reference').fill('damaged in transit');

    await expect(page.getByRole('button', { name: 'Request approval' })).toBeVisible();
    await page.getByRole('button', { name: 'Request approval' }).click();
    await expect(
      page.locator('#main').getByText(/Removal approval requested/).first(),
    ).toBeVisible();

    const approval = session.posts.find((post) => post.path === '/approvals');
    expect(approval?.body).toMatchObject({
      actionType: 'stock_disposal',
      payload: { item: 'v-crb15-15', delta: -3, note: 'damaged in transit' },
    });
    expect(
      session.posts.some((post) => post.path.startsWith('/inventory/') && post.path.includes('/movements')),
    ).toBe(false);

    await page.getByRole('button', { name: 'Record movement' }).click();
    const movement = session.posts.find((post) => post.path.includes('/movements'));
    expect(movement?.body).toMatchObject({
      movementType: 'adjustment',
      quantityDelta: -3,
      approvalRequestId: 'apr-1',
    });
  });
});
