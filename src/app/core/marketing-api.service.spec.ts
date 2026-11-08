import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { MarketingApiService } from './marketing-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(MarketingApiService),
  };
}

const CAMPAIGN = {
  id: 'cmp-1',
  name: 'Detty December drop',
  type: 'campaign',
  channel: 'instagram',
  discountPercent: 15,
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  createdAt: '2026-11-01T00:00:00Z',
};

describe('MarketingApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs campaigns with paging', async () => {
    const { http, service } = init();
    const promise = service.list({ page: 2, limit: 10 });
    const req = http.expectOne('/api/v1/campaigns?page=2&limit=10');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [CAMPAIGN], total: 1 });
    const result = await promise;
    expect(result.data[0].name).toBe('Detty December drop');
    expect(result.data[0].channel).toBe('instagram');
    expect(result.data[0].discountPercent).toBe(15);
  });

  it('POSTs a new campaign with the exact input', async () => {
    const { http, service } = init();
    const input = {
      name: 'Detty December drop',
      type: 'campaign',
      channel: 'instagram',
      discountPercent: 15,
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    } as const;
    const promise = service.create(input);
    const req = http.expectOne('/api/v1/campaigns');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(CAMPAIGN);
    expect((await promise).id).toBe('cmp-1');
  });
});
