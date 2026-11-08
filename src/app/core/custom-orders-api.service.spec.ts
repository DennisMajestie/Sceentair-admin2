import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { CustomOrdersApiService } from './custom-orders-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(CustomOrdersApiService),
  };
}

const REQUEST = {
  id: 'co-1',
  buyer: { id: 'u-7', name: 'Ada Retail', email: 'ada@retail.ng', phone: '0801', role: null },
  sizes: 'M, L',
  colours: 'Black',
  quantity: 30,
  location: 'Lagos',
  fabricQuality: 'Cotton fleece',
  description: 'Hoodie set',
  desiredDate: '2026-06-01',
  status: 'quoted',
  reviewNote: 'Feasible',
  paidAt: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
};

const QUOTATION = {
  id: 'q-1',
  request: REQUEST,
  amount: 450000,
  note: 'Fabric + labour',
  approvedBy: 'u-2',
  createdAt: '2026-05-03T00:00:00Z',
};

describe('CustomOrdersApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the custom order list with paging', async () => {
    const { http, service } = init();
    const promise = service.list(1, 25);
    const req = http.expectOne('/api/v1/custom-orders?page=1&limit=25');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [REQUEST], total: 1 });
    const result = await promise;
    expect(result.data[0].status).toBe('quoted');
    expect(result.data[0].buyer.name).toBe('Ada Retail');
  });

  it('GETs order detail and quotation via encode-safe ids', async () => {
    const { http, service } = init();
    const detailPromise = service.detail('co 1');
    const detailReq = http.expectOne('/api/v1/custom-orders/co%201');
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush(REQUEST);
    const quotationPromise = service.quotation('co 1');
    const quoteReq = http.expectOne('/api/v1/custom-orders/co%201/quotation');
    expect(quoteReq.request.method).toBe('GET');
    quoteReq.flush(QUOTATION);
    expect((await detailPromise).id).toBe('co-1');
    expect((await quotationPromise).amount).toBe(450000);
  });

  it('POSTs a quotation with amount and note', async () => {
    const { http, service } = init();
    const promise = service.sendQuotation('co-1', { amount: 450000, note: 'Fabric + labour' });
    const req = http.expectOne('/api/v1/custom-orders/co-1/quotation');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 450000, note: 'Fabric + labour' });
    req.flush(QUOTATION);
    expect((await promise).id).toBe('q-1');
  });

  it('POSTs payment and sample-approval records with the exact payload', async () => {
    const { http, service } = init();
    const paymentPromise = service.recordPayment('co-1', { method: 'bank_transfer', amount: 450000 });
    const payReq = http.expectOne('/api/v1/custom-orders/co-1/payment');
    expect(payReq.request.method).toBe('POST');
    expect(payReq.request.body).toEqual({ method: 'bank_transfer', amount: 450000 });
    payReq.flush({});
    const samplePromise = service.recordSampleDecision('co-1', { approved: true });
    const sampleReq = http.expectOne('/api/v1/custom-orders/co-1/sample-approval');
    expect(sampleReq.request.method).toBe('POST');
    expect(sampleReq.request.body).toEqual({ approved: true });
    sampleReq.flush({});
    await paymentPromise;
    await samplePromise;
  });

  it('PATCHes status with note support', async () => {
    const { http, service } = init();
    const promise = service.updateStatus('co-1', { status: 'in_production', note: 'Line 2' });
    const req = http.expectOne('/api/v1/custom-orders/co-1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'in_production', note: 'Line 2' });
    req.flush({ ...REQUEST, status: 'in_production' });
    expect((await promise).status).toBe('in_production');
  });
});
