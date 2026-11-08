import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { AuditApiService } from './audit-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(AuditApiService),
  };
}

describe('AuditApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs audit-log entries with paging and optional action filter', async () => {
    const { http, service } = init();
    const promise = service.list(3, 20, 'order.status_change');
    const req = http.expectOne('/api/v1/audit-log?page=3&limit=20&action=order.status_change');
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [
        {
          id: 'aud-1',
          actorId: 'u-1',
          action: 'order.status_change',
          beforeState: { status: 'new' },
          afterState: { status: 'picking' },
          timestamp: '2026-02-01T10:00:00Z',
        },
      ],
      total: 42,
    });
    const result = await promise;
    expect(result.total).toBe(42);
    expect(result.data[0].action).toBe('order.status_change');
    expect(result.data[0].beforeState).toEqual({ status: 'new' });
    expect(result.data[0].afterState).toEqual({ status: 'picking' });
  });

  it('defaults to page 1 / limit 50 with no action param', async () => {
    const { http, service } = init();
    const promise = service.list();
    const req = http.expectOne('/api/v1/audit-log?page=1&limit=50');
    expect(req.request.params.get('action')).toBe(null);
    req.flush({ data: [], total: 0 });
    expect(await promise).toEqual({ data: [], total: 0 });
  });

  it('GETs hash-chain verification totals', async () => {
    const { http, service } = init();
    const promise = service.verify();
    const req = http.expectOne('/api/v1/audit-log/verify');
    expect(req.request.method).toBe('GET');
    req.flush({ total: 120, valid: 119, broken: 1, headHash: 'abc123' });
    const result = await promise;
    expect(result.valid).toBe(119);
    expect(result.broken).toBe(1);
    expect(result.headHash).toBe('abc123');
  });
});
