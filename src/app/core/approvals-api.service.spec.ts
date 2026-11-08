import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { ApprovalsApiService } from './approvals-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(ApprovalsApiService),
  };
}

const APPROVAL = {
  id: 'ap-1',
  actionType: 'price_change',
  payload: { productId: 'p-1', from: 2500, to: 3000 },
  requestedBy: 'u-2',
  status: 'pending',
  approvedBy: null,
  justification: 'Covers delivery cost rise',
  decidedAt: null,
  createdAt: '2026-02-01T08:00:00Z',
};

describe('ApprovalsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the approval list with status and actionType filters', async () => {
    const { http, service } = init();
    const promise = service.list({ page: 1, limit: 50, status: 'pending', actionType: 'purchasing' });
    const req = http.expectOne('/api/v1/approvals?page=1&limit=50&status=pending&actionType=purchasing');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [APPROVAL], total: 1 });
    const result = await promise;
    expect(result.total).toBe(1);
    expect(result.data[0].actionType).toBe('price_change');
    expect(result.data[0].status).toBe('pending');
  });

  it('GETs the pending queue without paging params', async () => {
    const { http, service } = init();
    const promise = service.pending();
    const req = http.expectOne('/api/v1/approvals/pending');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0 });
    expect(await promise).toEqual({ data: [], total: 0 });
  });

  it('POSTs a new approval with actionType, payload and justification', async () => {
    const { http, service } = init();
    const dto = { actionType: 'stock_disposal', payload: { qty: 4 }, justification: 'Damaged in QC' } as const;
    const promise = service.create(dto);
    const req = http.expectOne('/api/v1/approvals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ ...APPROVAL, actionType: 'stock_disposal', status: 'pending' });
    const created = await promise;
    expect(created.actionType).toBe('stock_disposal');
  });

  it('POSTs a decision to the encode-safe decide endpoint', async () => {
    const { http, service } = init();
    const promise = service.decide('ap 1', { decision: 'rejected', resolution: 'Insufficient justification' });
    const req = http.expectOne('/api/v1/approvals/ap%201/decide');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'rejected', resolution: 'Insufficient justification' });
    req.flush({ ...APPROVAL, status: 'rejected', approvedBy: 'u-1', decidedAt: '2026-02-02T09:00:00Z' });
    const decided = await promise;
    expect(decided.status).toBe('rejected');
  });
});
