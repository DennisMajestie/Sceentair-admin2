import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { CouponsApiService } from './coupons-api.service';

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
});
