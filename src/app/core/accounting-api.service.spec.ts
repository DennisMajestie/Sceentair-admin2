import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { AccountingApiService } from './accounting-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  const http = TestBed.inject(HttpTestingController);
  const service = TestBed.inject(AccountingApiService);
  return { http, service };
}

describe('AccountingApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the ledger with paging and optional filters', async () => {
    const { http, service } = init();
    const promise = service.list({
      page: 2,
      limit: 25,
      type: 'sale',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    const req = http.expectOne('/api/v1/accounting/ledger?page=2&limit=25&type=sale&from=2026-01-01&to=2026-01-31');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('type')).toBe('sale');
    req.flush({
      data: [
        {
          id: 'led-1',
          type: 'sale',
          amount: 12500,
          category: 'online',
          referenceId: 'order-1',
          recordedBy: 'u-1',
          entryAt: '2026-01-10T09:00:00Z',
        },
      ],
      total: 1,
    });
    const result = await promise;
    expect(result.total).toBe(1);
    expect(result.data[0].type).toBe('sale');
    expect(result.data[0].amount).toBe(12500);
    expect(result.data[0].category).toBe('online');
  });

  it('omits unset filters from the ledger query', async () => {
    const { http, service } = init();
    const promise = service.list({ page: 1, limit: 50 });
    const req = http.expectOne('/api/v1/accounting/ledger?page=1&limit=50');
    expect(req.request.url).toBe('/api/v1/accounting/ledger');
    expect(req.request.params.get('type')).toBe(null);
    expect(req.request.params.get('from')).toBe(null);
    req.flush({ data: [], total: 0 });
    expect(await promise).toEqual({ data: [], total: 0 });
  });

  it('GETs a typed report with the date range params', async () => {
    const { http, service } = init();
    const promise = service.report('profit', '2026-01-01', '2026-03-31');
    const req = http.expectOne('/api/v1/accounting/reports/profit?from=2026-01-01&to=2026-03-31');
    expect(req.request.method).toBe('GET');
    req.flush({
      type: 'profit',
      total: 48000,
      period: { from: '2026-01-01T00:00:00Z', to: '2026-03-31T00:00:00Z' },
      entries: [],
    });
    const result = await promise;
    expect(result.type).toBe('profit');
    expect(result.total).toBe(48000);
    expect(result.period.from).toBe('2026-01-01T00:00:00Z');
  });

  it('POSTs a manual ledger entry body verbatim', async () => {
    const { http, service } = init();
    const body = { type: 'expense', amount: 3000, category: 'delivery', note: 'GIGL Jan' };
    const promise = service.recordEntry(body);
    const req = http.expectOne('/api/v1/accounting/ledger');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'led-9' });
    expect(await promise).toEqual({ id: 'led-9' });
  });
});
