import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { ReturnsApiService, ResolveReturnInput } from './returns-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(ReturnsApiService),
  };
}

const RETURN = {
  id: 'r-1',
  order: { id: 'order-1', customer: { id: 'c-1', name: 'Ada Retail' }, items: [] },
  variant: { id: 'var-1', sku: 'HD-BLK-M', size: 'M', colour: 'Black', priceOverride: null, imageUrl: null, availabilityStatus: 'available', storageLocation: null, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  quantity: 1,
  refundAmount: 12500,
  photoUrls: ['./photo-1.jpg'],
  bayTag: null,
  reason: 'Zipper broke',
  requestedAt: '2026-05-01T09:00:00Z',
  returnDeadline: '2026-05-02T09:00:00Z',
  trackingNumber: 'GIG-4442',
  status: 'requested',
  resolution: null,
  restocked: false,
  damaged: false,
  resolvedBy: null,
  resolvedAt: null,
};

describe('ReturnsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the returns queue with paging', async () => {
    const { http, service } = init();
    const promise = service.list(2, 15);
    const req = http.expectOne('/api/v1/returns?page=2&limit=15');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [RETURN], total: 1 });
    const result = await promise;
    expect(result.data[0].status).toBe('requested');
    expect(result.data[0].returnDeadline).toBe('2026-05-02T09:00:00Z');
    expect(result.data[0].order.customer?.name).toBe('Ada Retail');
  });

  it('PATCHes a resolution with disposition, tracking, photos and bay tag', async () => {
    const { http, service } = init();
    const input: ResolveReturnInput = {
      decision: 'resolved',
      resolution: 'Refunded via Paystack',
      restocked: true,
      damaged: false,
      trackingNumber: 'GIG-9001',
      photoUrls: ['./z.jpg'],
      bayTag: 'BAY-12',
    };
    const promise = service.resolve('r 1', input);
    const req = http.expectOne('/api/v1/returns/r%201/resolve');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(input);
    req.flush({ ...RETURN, status: 'resolved', restocked: true, resolvedBy: 'u-1', resolvedAt: '2026-05-02T10:00:00Z' });
    const resolved = await promise;
    expect(resolved.status).toBe('resolved');
    expect(resolved.restocked).toBeTrue();
    expect(resolved.resolvedBy).toBe('u-1');
  });

  it('PATCHes a rejected decision without disposition flags', async () => {
    const { http, service } = init();
    const input: ResolveReturnInput = { decision: 'rejected', resolution: 'Outside 12h window' };
    const promise = service.resolve('r-1', input);
    const req = http.expectOne('/api/v1/returns/r-1/resolve');
    expect(req.request.body).toEqual(input);
    req.flush({ ...RETURN, status: 'rejected' });
    expect((await promise).status).toBe('rejected');
  });
});
