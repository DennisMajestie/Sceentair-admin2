import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { DeliveriesApiService } from './deliveries-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(DeliveriesApiService),
  };
}

const API_LEG = {
  id: 'leg-1',
  order_id: 'order-1',
  carrier: 'GIGL',
  leg_number: 1,
  status: 'in_transit',
  tracking_ref: 'GIG-9001',
  weight_kg: 12.5,
  zone: 'lagos_mainland',
  contents: { items: 3 },
  checkpoints: [{ at: '2026-05-02T08:00:00Z', label: 'Hub scanned' }],
  driver_name: 'Kelechi',
  driver_phone: '0802',
  cost: 6500,
  created_by: 'u-3',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-02T09:30:00Z',
};

describe('DeliveriesApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs delivery legs with status filter and maps snake_case to camelCase', async () => {
    const { http, service } = init();
    const promise = service.list({ page: 1, limit: 10, status: 'in_transit' });
    const req = http.expectOne('/api/v1/deliveries?page=1&limit=10&status=in_transit');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [API_LEG], total: 1 });
    const legs = await promise;
    expect(legs[0].orderId).toBe('order-1');
    expect(legs[0].trackingRef).toBe('GIG-9001');
    expect(legs[0].weightKg).toBe(12.5);
    expect(legs[0].driverName).toBe('Kelechi');
    expect(legs[0].createdAtNum).toBe(Date.parse('2026-05-01T00:00:00Z'));
    expect(legs[0].updatedAtNum).toBe(Date.parse('2026-05-02T09:30:00Z'));
    expect((legs[0] as any).order_id).toBeUndefined();
  });

  it('GETs tracking via /deliveries/:id/tracking', async () => {
    const { http, service } = init();
    const promise = service.tracking('leg 1');
    const req = http.expectOne('/api/v1/deliveries/leg%201/tracking');
    expect(req.request.method).toBe('GET');
    req.flush(API_LEG);
    expect((await promise).id).toBe('leg-1');
  });

  it('PATCHes leg status', async () => {
    const { http, service } = init();
    const promise = service.updateStatus('leg-1', { status: 'delivered' });
    const req = http.expectOne('/api/v1/deliveries/leg-1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'delivered' });
    req.flush({ ...API_LEG, status: 'delivered' });
    expect((await promise).status).toBe('delivered');
  });

  it('POSTs a checkpoint entry', async () => {
    const { http, service } = init();
    const promise = service.addCheckpoint('leg-1', { checkpoint: { label: 'Arrived at hub' } });
    const req = http.expectOne('/api/v1/deliveries/leg-1/checkpoint');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ checkpoint: { label: 'Arrived at hub' } });
    req.flush(API_LEG);
    expect((await promise).checkpoints).toEqual([{ at: '2026-05-02T08:00:00Z', label: 'Hub scanned' }]);
  });
});
