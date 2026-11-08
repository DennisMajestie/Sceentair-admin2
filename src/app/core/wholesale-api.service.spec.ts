import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { WholesaleApiService } from './wholesale-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(WholesaleApiService),
  };
}

const ACCOUNT = {
  id: 'wa-1',
  userId: 'u-9',
  tierId: 'wt-1',
  tierName: 'Retailer',
  status: 'pending',
  businessName: 'Lagos Threads',
  buyerType: 'retailer',
  businessPhone: '0803',
  city: 'Lagos',
  state: 'Lagos',
  openingVolume: 40,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  reviewedBy: null,
};

const TIER = {
  id: 'wt-1',
  name: 'Retailer',
  ruleDescription: '20+ units per order',
  discountPercent: 20,
  createdAt: '2026-01-01T00:00:00Z',
};

const PRICING = {
  variantId: 'var-1',
  sku: 'HD-BLK-M',
  name: 'Hoodie',
  retailPrice: 25000,
  wholesalePrice: 20000,
  discountPercent: 20,
  moq: 20,
};

describe('WholesaleApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('POSTs a wholesale application and GETs the account list with status filter', async () => {
    const { http, service } = init();
    const input = { businessName: 'Lagos Threads', businessPhone: '0803', city: 'Lagos', state: 'Lagos', openingVolume: 40, buyerType: 'retailer', tierId: null } as const;
    const applyPromise = service.apply(input);
    const applyReq = http.expectOne('/api/v1/wholesale/apply');
    expect(applyReq.request.method).toBe('POST');
    expect(applyReq.request.body).toEqual(input);
    applyReq.flush(ACCOUNT);
    expect((await applyPromise).status).toBe('pending');

    const listPromise = service.listAccounts({ page: 1, limit: 10, status: 'pending' });
    const listReq = http.expectOne('/api/v1/wholesale/accounts?page=1&limit=10&status=pending');
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ data: [ACCOUNT], total: 1 });
    const accounts = await listPromise;
    expect(accounts.data[0].buyerType).toBe('retailer');
    expect(accounts.data[0].openingVolume).toBe(40);
  });

  it('reviews an account through PATCH with reviewedBy set', async () => {
    const { http, service } = init();
    const promise = service.reviewAccount('wa-1', { status: 'approved', reviewedBy: 'u-1' });
    const req = http.expectOne('/api/v1/wholesale/accounts/wa-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'approved', reviewedBy: 'u-1' });
    req.flush({ ...ACCOUNT, status: 'approved', reviewedBy: 'u-1' });
    expect((await promise).status).toBe('approved');
  });

  it('manages tiers: list, create, update and delete', async () => {
    const { http, service } = init();
    const listPromise = service.listTiers({ page: 1, limit: 20 });
    const listReq = http.expectOne('/api/v1/wholesale/tiers?page=1&limit=20');
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ data: [TIER], total: 1 });
    expect((await listPromise).data[0].name).toBe('Retailer');

    const createInput = { name: 'Distributor', ruleDescription: '200+ units', discountPercent: 35 } as const;
    const createPromise = service.createTier(createInput);
    const createReq = http.expectOne('/api/v1/wholesale/tiers');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(createInput);
    createReq.flush({ ...TIER, name: 'Distributor' });
    await createPromise;

    const updatePromise = service.updateTier('wt-1', { discountPercent: 25 });
    const updateReq = http.expectOne('/api/v1/wholesale/tiers/wt-1');
    expect(updateReq.request.method).toBe('PATCH');
    updateReq.flush({ ...TIER, discountPercent: 25 });
    expect((await updatePromise).discountPercent).toBe(25);

    const deletePromise = service.deleteTier('wt 1');
    const deleteReq = http.expectOne('/api/v1/wholesale/tiers/wt%201');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
    expect(await deletePromise).toBeNull();
  });

  it('GETs pricing rows carrying the MOQ', async () => {
    const { http, service } = init();
    const promise = service.listPricing({ page: 1, limit: 100 });
    const req = http.expectOne('/api/v1/wholesale/pricing?page=1&limit=100');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [PRICING], total: 1 });
    const result = await promise;
    expect(result.data[0].wholesalePrice).toBe(20000);
    expect(result.data[0].moq).toBe(20);
  });

  it('GETs stock with repeated variantIds query params and invoices', async () => {
    const { http, service } = init();
    const stockPromise = service.listStock({ variantIds: ['var-1', 'var-2'] });
    const stockReq = http.expectOne('/api/v1/wholesale/stock?variantIds=var-1&variantIds=var-2');
    expect(stockReq.request.method).toBe('GET');
    expect(stockReq.request.params.getAll('variantIds')).toEqual(['var-1', 'var-2']);
    stockReq.flush({ data: [{ variantId: 'var-1', sku: 'HD-BLK-M', name: 'Hoodie', onHand: 120, reserved: 10, available: 110 }], total: 1 });
    const stock = await stockPromise;
    expect(stock.data[0].available).toBe(110);

    const invoicePromise = service.listInvoices({ page: 1, limit: 20 });
    const invoiceReq = http.expectOne('/api/v1/wholesale/invoices?page=1&limit=20');
    expect(invoiceReq.request.method).toBe('GET');
    invoiceReq.flush({ data: [{ id: 'wi-1', accountId: 'wa-1', accountName: 'Lagos Threads', orderId: 'order-1', amount: 80000, status: 'unpaid', createdAt: '2026-05-01T00:00:00Z', paidAt: null }], total: 1 });
    const invoices = await invoicePromise;
    expect(invoices.data[0].amount).toBe(80000);
  });
});
