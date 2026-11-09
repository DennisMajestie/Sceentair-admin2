import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { CouponsApiService, campaignStatus } from './coupons-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(CouponsApiService),
  };
}

const API_COUPON = {
  id: 'c-1',
  code: 'LAUNCH10',
  name: 'Launch promo',
  description: '10% off first order',
  type: 'percent_off',
  value: 10,
  max_discount: 2000,
  min_spend: 15000,
  starts_at: '2026-03-01T00:00:00Z',
  expires_at: '2026-03-31T00:00:00Z',
  usage_cap: 500,
  per_customer_cap: 1,
  applies_to_sale_items: false,
  times_used: 12,
  created_at: '2026-02-20T00:00:00Z',
  updated_at: '2026-02-20T00:00:00Z',
};

describe('CouponsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs my wallet and maps snake_case fields to camelCase', async () => {
    const { http, service } = init();
    const promise = service.mine(2, 20);
    const req = http.expectOne('/api/v1/coupons/mine?page=2&limit=20');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [API_COUPON], total: 1 });
    const wallet = await promise;
    expect(wallet).toHaveSize(1);
    expect(wallet[0].maxDiscount).toBe(2000);
    expect(wallet[0].minSpend).toBe(15000);
    expect(wallet[0].usageCap).toBe(500);
    expect(wallet[0].perCustomerCap).toBe(1);
    expect(wallet[0].appliesToSaleItems).toBeFalse();
    expect(wallet[0].timesUsed).toBe(12);
    expect((wallet[0] as any).max_discount).toBeUndefined();
  });

  it('POSTs the coupon claim payload', async () => {
    const { http, service } = init();
    const promise = service.claim({ coupon_id: 'c-1' });
    const req = http.expectOne('/api/v1/coupons/claim');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ coupon_id: 'c-1' });
    req.flush({ claimed: true, coupon_id: 'c-1', message: 'Added to your wallet' });
    const result = await promise;
    expect(result.claimed).toBeTrue();
    expect(result.message).toBe('Added to your wallet');
  });

  it('GETs admin coupons and normalises casing', async () => {
    const { http, service } = init();
    const promise = service.adminCoupons();
    const req = http.expectOne('/api/v1/coupons/admin/coupons');
    expect(req.request.method).toBe('GET');
    req.flush([{ ...API_COUPON, is_active: true, per_customer_cap: 2 }]);
    const rows = await promise;
    expect(rows).toHaveSize(1);
    expect(rows[0].isActive).toBeTrue();
    expect(rows[0].perCustomerCap).toBe(2);
  });

  it('creates a coupon and unwraps the returned coupon', async () => {
    const { http, service } = init();
    const promise = service.createCoupon({
      name: 'Spring',
      type: 'percent_off',
      value: 10,
      maxDiscount: 2000,
      audience: 'all',
      reason: 'launch',
    });
    const req = http.expectOne('/api/v1/coupons/admin/coupons');
    expect(req.request.method).toBe('POST');
    req.flush({ coupon: { ...API_COUPON, is_active: true }, marginWarning: null });
    const created = await promise;
    expect(created.id).toBe('c-1');
    expect(created.isActive).toBeTrue();
  });

  it('deactivates a coupon with a reason in the body', async () => {
    const { http, service } = init();
    const promise = service.deactivateCoupon('c-1', 'mistake');
    const req = http.expectOne('/api/v1/coupons/admin/coupons/c-1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ reason: 'mistake' });
    req.flush({ ...API_COUPON, is_active: false });
    const coupon = await promise;
    expect(coupon.isActive).toBeFalse();
  });

  it('GETs campaigns and normalises their window fields', async () => {
    const { http, service } = init();
    const promise = service.campaigns();
    const req = http.expectOne('/api/v1/coupons/admin/campaigns');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'cc-1',
        headline: 'Sale',
        starts_at: '2026-03-01T00:00:00Z',
        ends_at: '2026-04-01T00:00:00Z',
        claim_kind: 'coupon',
        is_active: true,
      },
    ]);
    const rows = await promise;
    expect(rows[0].startsAt).toBe('2026-03-01T00:00:00Z');
    expect(rows[0].claimKind).toBe('coupon');
    expect(rows[0].isActive).toBeTrue();
  });

  it('coerces report counts to numbers', async () => {
    const { http, service } = init();
    const promise = service.report();
    const req = http.expectOne('/api/v1/coupons/admin/report');
    req.flush([{ coupon_id: 'c-1', code: 'X', name: 'X', held: '4', used: null, expired: '2' }]);
    const rows = await promise;
    expect(rows[0].held).toBe(4);
    expect(rows[0].used).toBe(0);
    expect(rows[0].expired).toBe(2);
  });
});

describe('campaignStatus', () => {
  it('derives the banner state from the window', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    expect(
      campaignStatus({ startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' }, now),
    ).toBe('running');
    expect(
      campaignStatus({ startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-02-01T00:00:00Z' }, now),
    ).toBe('ended');
    expect(
      campaignStatus({ startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }, now),
    ).toBe('upcoming');
  });
});
