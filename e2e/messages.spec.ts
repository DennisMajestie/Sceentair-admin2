import { expect, test } from '@playwright/test';
import { authUser, mockBackend } from './support/mock-backend';

const CUSTOMER_ORDER = {
  id: '8626acab-28dd-473f-b587-42ff7ab8865d',
  customer: { id: 'c1', name: 'Adaeze O.', email: 'adaeze@example.ng', phone: null },
  guestName: null,
  guestEmail: null,
  channel: 'retail',
  source: null,
  status: 'order_received',
  paymentStatus: 'paid',
  totalAmount: 9000,
  deliveryFee: null,
  shippingAddress: null,
  deliveryMethod: null,
  deliveredAt: null,
  items: [],
  createdAt: '2026-09-15T15:27:00Z',
  updatedAt: '2026-09-15T15:27:00Z',
};

const TRACKING_MACRO =
  'Hello! Your order is with the courier; we will share the live tracking link as soon as it is dispatched.';

test.describe('messages support desk', () => {
  test('groups orders into customer threads and sends an order update', async ({ page }) => {
    const session = await mockBackend(page, [
      {
        match: /\/auth\/me$/,
        data: { ...authUser, access: { ...authUser.access, communication: 'full' } },
      },
      { match: /\/orders(\?.*)?$/, data: { data: [CUSTOMER_ORDER], total: 1 } },
    ]);
    await page.goto('/messages');

    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adaeze O.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Returns requested/ })).toBeVisible();

    await page.getByRole('button', { name: 'Adaeze O.' }).click();
    const drawer = page.locator('app-drawer');
    await expect(drawer.getByText(/₦9,000 lifetime/)).toBeVisible();
    await drawer.getByRole('button', { name: 'Send tracking' }).click();
    await drawer.getByRole('button', { name: 'Send update' }).click();

    await expect(page.getByText('Update sent to Adaeze O.')).toBeVisible();
    const post = session.posts.find((entry) => entry.path === '/notifications/send');
    expect(post?.body).toEqual({
      recipientId: 'c1',
      channel: 'in_platform',
      type: 'order_update',
      message: TRACKING_MACRO,
      relatedOrderId: '8626acab-28dd-473f-b587-42ff7ab8865d',
    });
  });

  test('a view-only role can read threads but not message customers', async ({ page }) => {
    await mockBackend(page, [
      {
        match: /\/auth\/me$/,
        data: { ...authUser, access: { ...authUser.access, communication: 'view' } },
      },
      { match: /\/orders(\?.*)?$/, data: { data: [CUSTOMER_ORDER], total: 1 } },
    ]);
    await page.goto('/messages');

    await expect(page.getByRole('button', { name: 'Adaeze O.' })).toBeVisible();
    await expect(page.getByText('View only')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send update' })).toHaveCount(0);
  });
});
