import type { Page } from '@playwright/test';

export const API_ROOT = '**/api/v1/**';

export interface RouteRule {
  method?: string;
  match: RegExp;
  status?: number;
  data: unknown | ((url: URL, body: unknown) => unknown);
}

export const authUser = {
  id: 'u-admin',
  email: 'admin@vessa.test',
  role: 'business_owner_admin',
  name: 'Adebayo Admin',
  phone: '0800 000 0000',
  title: 'Owner',
  access: {
    inventory: 'FULL',
    products_catalogue: 'FULL',
    orders_fulfilment: 'FULL',
    customers_relationship: 'FULL',
    purchasing_inventory: 'FULL',
    production_workflow: 'FULL',
    raw_materials: 'FULL',
    logistics_dispatch: 'FULL',
    marketing_promotions: 'FULL',
    wholesale_b2b: 'FULL',
    finance_accounting: 'FULL',
    approvals_audit: 'FULL',
    settings_team: 'FULL',
    integrations_api: 'FULL',
    support_ops: 'FULL',
    analytics_insights: 'FULL',
    comms_support: 'FULL',
    help_center: 'FULL',
    media_kit: 'FULL',
  },
  totpEnabled: false,
};

const VARIANT = {
  id: 'v-crb15-15',
  size: 'M',
  colour: 'Navy',
  sku: 'CRB15-M-NAVY',
  priceOverride: null,
  imageUrl: null,
  availabilityStatus: 'in_stock',
  storageLocation: null,
};

const PRODUCT = {
  id: 'p-tee',
  name: 'Crab Tee',
  description: 'Cut-and-sew tee.',
  category: 'Tops',
  isBestseller: true,
  basePrice: 4200,
  salePercent: null,
  saleEndsAt: null,
  primaryImageUrl: null,
  sizeClass: 'M',
  variants: [VARIANT],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
  soldCount: 25,
};

const MATERIAL = {
  id: 'm-shea',
  name: 'Shea butter',
  unit: 'kg',
  category: 'other',
  storageLocation: 'Warehouse A',
  reorderThreshold: 10,
  createdAt: '2025-01-01T00:00:00Z',
  currentQuantity: 46,
  lowStock: false,
};

const SUMMARY = [
  {
    itemType: 'variant',
    itemId: 'v-crb15-15',
    currentQuantity: 612,
    byMovementType: { PURCHASE: 700, SALE: -88 },
  },
  {
    itemType: 'material',
    itemId: 'm-shea',
    currentQuantity: 46,
    byMovementType: { PURCHASE: 60, PRODUCTION: -14 },
  },
];

const emptyList = { data: [], total: 0 };

const ORDER = {
  id: 'o-1',
  customer: null,
  guestName: 'Ada Okafor',
  guestEmail: 'ada@okafor.ng',
  channel: 'retail',
  source: null,
  status: 'processing',
  paymentStatus: 'paid',
  totalAmount: 105000,
  deliveryFee: null,
  shippingAddress: { state: 'Lagos', city: 'Ikeja', line: '12 Pepple St', phone: '0800 111 2222' },
  deliveryMethod: 'pickup',
  deliveredAt: null,
  items: [
    {
      id: 'oi-1',
      quantity: 25,
      unitPrice: 4200,
      variant: {
        id: 'v-crb15-15',
        sku: 'CRB15-M-NAVY',
        size: 'M',
        colour: 'Navy',
        imageUrl: null,
        product: { id: 'p-tee', name: 'Crab Tee', primaryImageUrl: null },
      },
    },
  ],
  createdAt: '2026-03-05T09:00:00Z',
  updatedAt: '2026-03-06T09:00:00Z',
};

const REVIEW = {
  id: 'rw-1',
  orderId: 'o-1',
  rating: 4,
  comment: 'Fits true to size, heavy cotton.',
  status: 'pending',
  customerId: null,
  createdAt: '2026-03-07T14:00:00Z',
  variant: {
    id: 'v-crb15-15',
    sku: 'CRB15-M-NAVY',
    size: 'M',
    colour: 'Navy',
    product: { id: 'p-tee', name: 'Crab Tee' },
  },
};

const CUSTOM_ORDER = {
  id: 'co-1',
  buyer: { id: 'buy-1', name: 'Stella Nwosu', email: 'stella@nwosu.ng', phone: null, role: null },
  sizes: 'S,M,L',
  colours: 'Navy',
  quantity: 120,
  location: 'Abuja',
  fabricQuality: '260gsm French terry',
  description: 'Club-branded polos.',
  desiredDate: '2026-05-01',
  status: 'submitted',
  reviewNote: null,
  paidAt: null,
  createdAt: '2026-03-08T10:00:00Z',
  updatedAt: '2026-03-08T10:00:00Z',
};

const TECH_PACK = {
  id: 'tp-1',
  variant: { id: 'v-crb15-15', sku: 'CRB15-M-NAVY', size: 'M', colour: 'Navy', product: { id: 'p-tee', name: 'Crab Tee', category: 'Tops' } },
  silhouette: 'Classic tee',
  targetYieldUnits: 480,
  cuttingEfficiencyPct: 78.5,
  gradedMeasurements: null,
  stitchProtocol: 'Single-needle jersey seams',
  laydownProtocol: null,
  dxfUrl: null,
  revision: 1,
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  updatedBy: null,
  createdAt: '2026-02-20T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  revisionCount: 1,
};

const BATCH = {
  id: 'pb-1',
  variant: { id: 'v-crb15-15', sku: 'CRB15-M-NAVY' },
  quantity: 700,
  stage: 'sewing',
  plannedDate: '2026-03-10',
  completedDate: null,
  approvalRequestId: null,
  barcode: 'PB-1-0001',
  createdBy: 'u-admin',
  createdAt: '2026-03-05T08:00:00Z',
};

const BATCH_COST = {
  id: 'pb-1',
  materialCost: 154000,
  sewingCost: 91000,
  brandingCost: 35000,
  packagingCost: 7000,
  confirmedComponents: ['material', 'sewing', 'branding'],
  totalCost: 287000,
};

export const baseRules: RouteRule[] = [
  { method: 'POST', match: /\/auth\/login$/, data: { accessToken: 'e2e-access-token' } },
  { method: 'POST', match: /\/auth\/refresh$/, data: { accessToken: 'e2e-access-token' } },
  { method: 'GET', match: /\/auth\/me$/, data: authUser },
  { match: /\/inventory\/summary$/, data: SUMMARY },
  {
    match: /\/inventory\/ledger\/verify$/,
    data: { total: 24, valid: 24, broken: 0, headHash: 'abcdef0123456789fff0f0f0f0f0f0f0' },
  },
  {
    match: /\/inventory\/counts$/,
    data: {
      data: [
        {
          id: 'c-1',
          number: 'CNT-001',
          status: 'done',
          lines: [
            { itemType: 'variant', itemId: 'v-crb15-15', countedQuantity: 600, approvalRequestId: null },
          ],
          createdAt: '2026-03-01T10:00:00Z',
        },
      ],
      total: 1,
    },
  },
  {
    match: /\/inventory\/v-crb15-15\/movements/,
    data: {
      data: [
        {
          id: 'mv-1',
          movementType: 'production',
          quantityDelta: 700,
          timestamp: '2026-03-01T09:00:00Z',
          referenceId: 'BATCH-1',
        },
        {
          id: 'mv-2',
          movementType: 'sale',
          quantityDelta: -88,
          timestamp: '2026-03-02T10:30:00Z',
          referenceId: 'ORD-77',
        },
      ],
      total: 2,
      currentQuantity: 612,
    },
  },
  { match: /\/inventory\/m-shea\/movements/, data: { data: [], total: 0, currentQuantity: 46 } },
  {
    match: /\/inventory\/digest\/variant\/v-crb15-15$/,
    data: {
      itemType: 'variant',
      itemId: 'v-crb15-15',
      currentQuantity: 612,
      entryCount: 2,
      firstTimestamp: '2026-03-01T09:00:00Z',
      lastTimestamp: '2026-03-02T10:30:00Z',
      ledgerHead: '0123456789abcdef0123456789abcdef',
    },
  },
  { match: /\/products(\?.*)?$/, data: { data: [PRODUCT], total: 1 } },
  { match: /\/products\/p-tee$/, data: PRODUCT },
  { match: /\/materials\/valuation$/, data: [MATERIAL] },
  { match: /\/materials(\?.*)?$/, data: { data: [MATERIAL], total: 1 } },
  { match: /\/production-batches(\?.*)?$/, data: { data: [], total: 0, stages: [] } },
  { match: /\/returns(\?.*)?$/, data: emptyList },
  { match: /\/suppliers(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/customers(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/orders(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/tickets(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/purchases(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/users(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/help\/tickets(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/materials\/purchases(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/notifications(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/audit-log(\?.*)?$/, data: { data: [], total: 0 } },
  { match: /\/accounting\/ledger(\?.*)?$/, data: { data: [], total: 0 } },
  {
    method: 'POST',
    match: /\/approvals$/,
    data: {
      id: 'apr-1',
      actionType: 'stock_disposal',
      status: 'pending',
      payload: {},
      createdAt: '2026-03-02T12:00:00Z',
    },
  },
  { match: /\/approvals(\?.*)?$/, data: emptyList },
  { match: /\/business\/profile$/, data: { name: 'Vessa Ltd', currency: 'NGN' } },
  { match: /\/deliveries(\?.*)?$/, data: emptyList },
  { match: /\/analytics\/low-stock(\?.*)?$/, data: { materials: [], variants: [] } },
  { match: /\/analytics\/best-sellers(\?.*)?$/, data: [] },
  { match: /\/analytics\/inventory-valuation(\?.*)?$/, data: [] },
  { match: /\/analytics\/inventory-movement-trend(\?.*)?$/, data: [] },
  { match: /\/config\/public$/, data: { currencyCode: 'NGN', currencySymbol: '₦', locale: 'en-NG', serverNow: '2026-03-06T12:00:00Z' } },
  { match: /\/orders\/o-1\/tracking$/, data: { status: 'processing', deliveredAt: null, events: [
    { status: 'processing', note: 'Payment confirmed', actor: 'System', createdAt: '2026-03-05T09:05:00Z' },
  ], deliveries: [] } },
  { match: /\/orders\/o-1$/, data: ORDER },
  { match: /\/reviews\/pending$/, data: [REVIEW] },
  { match: /\/custom-orders(\?.*)?$/, data: { data: [CUSTOM_ORDER], total: 1 } },
  { match: /\/tech-packs(\?.*|\/.*)?$/, data: [TECH_PACK] },
  { match: /\/production-batches\/pb-1\/bom$/, data: [
    { materialId: 'm-shea', materialName: 'Shea butter', unit: 'kg', plannedQuantity: 140, consumedQuantity: 122 },
  ] },
  { match: /\/production-batches\/pb-1\/cost$/, data: BATCH_COST },
  { match: /\/production-batches\/pb-1\/qc-rejections$/, data: [] },
  { match: /\/production-batches\/pb-1\/scans$/, data: [
    { id: 'bs-1', stage: 'sewing', scannedBy: 'Tailor 2', scannedAt: '2026-03-06T15:20:00Z' },
    { id: 'bs-2', stage: 'cutting', scannedBy: 'Tailor 1', scannedAt: '2026-03-05T11:05:00Z' },
  ] },
  { match: /\/production-batches\/pb-1$/, data: BATCH },
  { match: /\/production-batches\//, data: { data: [], stages: [], total: 0 } },
  {
    method: 'GET',
    match: /\/coupons\/admin\/campaigns$/,
    data: [
      {
        id: 'cc-1',
        badgeText: '20% OFF',
        headline: 'Mid-season sale',
        offerText: 'Ends soon',
        labelText: 'Limited time offer',
        startsAt: '2026-03-01T00:00:00Z',
        endsAt: '2026-04-01T00:00:00Z',
        placement: 'home_top',
        claimKind: 'coupon',
        couponId: 'c-1',
        bundleId: null,
        isActive: true,
        createdAt: '2026-02-25T00:00:00Z',
        updatedAt: '2026-02-25T00:00:00Z',
      },
    ],
  },
  {
    method: 'GET',
    match: /\/coupons\/admin\/coupons$/,
    data: [
      {
        id: 'c-1',
        code: 'LAUNCH10',
        name: 'Launch promo',
        description: '10% off first order',
        type: 'percent_off',
        value: 10,
        maxDiscount: 2000,
        minSpend: 15000,
        startsAt: '2026-03-01T00:00:00Z',
        expiresAt: '2026-03-31T00:00:00Z',
        usageCap: 500,
        perCustomerCap: 1,
        audience: 'all',
        appliesToSaleItems: false,
        isActive: true,
        timesUsed: 12,
        createdAt: '2026-02-20T00:00:00Z',
        updatedAt: '2026-02-20T00:00:00Z',
      },
    ],
  },
  { method: 'GET', match: /\/coupons\/admin\/bundles$/, data: [] },
  {
    method: 'GET',
    match: /\/coupons\/admin\/report$/,
    data: [{ couponId: 'c-1', code: 'LAUNCH10', name: 'Launch promo', held: 40, used: 12, expired: 3 }],
  },
];

export interface PostRecording {
  path: string;
  body: unknown;
}

export interface MockSession {
  posts: PostRecording[];
}

export async function mockBackend(page: Page, rules: RouteRule[] = []): Promise<MockSession> {
  const session: MockSession = { posts: [] };

  // Force the app onto the same origin so every call is intercepted below.
  // index.html hardcodes VESSA_CONFIG to an absolute dev URL (localhost:3000);
  // the non-writable property makes that inline assignment a silent no-op.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'VESSA_CONFIG', {
      value: { apiBaseUrl: '/api/v1' },
      writable: false,
      configurable: false,
    });
  });

  await page.context().route(API_ROOT, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/.*\/api\/v1/, '');
    const method = request.method();

    if (method === 'POST') {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      session.posts.push({ path, body });
    }

    for (const rule of [...rules, ...baseRules]) {
      if (rule.method && rule.method !== method) continue;
      if (!rule.match.test(path)) continue;
      const payload =
        typeof rule.data === 'function'
          ? (rule.data as (url: URL, body: unknown) => unknown)(url, body)
          : rule.data;
      await route.fulfill({
        status: rule.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) });
  });
  return session;
}

const noSession = { message: 'No stored session' };

export async function signIn(page: Page): Promise<MockSession> {
  const session = await mockBackend(page, [
    { method: 'POST', match: /\/auth\/refresh$/, status: 401, data: noSession },
  ]);
  await page.goto('/signin');
  await page.locator('input[name="email"]').fill('admin@vessa.test');
  await page.locator('input[name="password"]').fill('correct-horse-battery');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.waitForURL('**/dashboard/overview');
  await page.waitForLoadState('networkidle');
  return session;
}
