import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { LogisticsApiService } from './logistics-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(LogisticsApiService),
  };
}

const PRICING = [
  { id: 'zp-1', zone: 'lagos_mainland', baseKg: 1, basePrice: 2500, perKgPrice: 350 },
];

const SETTINGS = {
  shippingEnabled: true,
  freeDeliveryThreshold: 100000,
  quoteExpiryMinutes: 30,
  vatEnabled: true,
  vatRatePercent: 7.5,
  pricesIncludeVat: false,
  deliveryTaxable: true,
  couponsEnabled: true,
};

describe('LogisticsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs zone pricing and POSTs an upsert verbatim', async () => {
    const { http, service } = init();
    const listPromise = service.pricing();
    const listReq = http.expectOne('/api/v1/logistics/pricing');
    expect(listReq.request.method).toBe('GET');
    listReq.flush(PRICING);
    const result = await listPromise;
    expect(result[0].zone).toBe('lagos_mainland');
    expect(result[0].perKgPrice).toBe(350);

    const body = { zone: 'abuja', baseKg: 2, basePrice: 4000, perKgPrice: 300 };
    const upsertPromise = service.upsertPricing(body);
    const upsertReq = http.expectOne('/api/v1/logistics/pricing');
    expect(upsertReq.request.method).toBe('POST');
    expect(upsertReq.request.body).toEqual(body);
    upsertReq.flush({});
    await upsertPromise;
  });

  it('GETs a quote by weight and zone', async () => {
    const { http, service } = init();
    const promise = service.quote(12.5, 'lagos_mainland');
    const req = http.expectOne('/api/v1/logistics/quote?weightKg=12.5&zone=lagos_mainland');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('weightKg')).toBe('12.5');
    expect(req.request.params.get('zone')).toBe('lagos_mainland');
    req.flush({ cost: 6875 });
    expect((await promise).cost).toBe(6875);
  });

  it('GETs admin shipping settings and PATCHes updates with the audit reason', async () => {
    const { http, service } = init();
    const getPromise = service.shippingSettings();
    const getReq = http.expectOne('/api/v1/checkout-shipping/admin/settings');
    expect(getReq.request.method).toBe('GET');
    getReq.flush(SETTINGS);
    expect((await getPromise).vatRatePercent).toBe(7.5);

    const update = { vatEnabled: false, reason: 'VAT handled at POS' };
    const patchPromise = service.updateShippingSettings(update);
    const patchReq = http.expectOne('/api/v1/checkout-shipping/admin/settings');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual(update);
    patchReq.flush({ ...SETTINGS, vatEnabled: false });
    expect((await patchPromise).vatEnabled).toBeFalse();
  });
});
