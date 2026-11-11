import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { PartnersApiService } from './partners-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(PartnersApiService),
  };
}

const PARTNER = {
  id: 'pt-1',
  userId: 'u-8',
  userName: 'Ngozi Umeh',
  userEmail: 'ngozi@invest.ng',
  equityPercentage: 12.5,
  investedAmount: 2500000,
  createdAt: '2026-01-10T00:00:00Z',
};

const DISTRIBUTION = {
  id: 'pd-1',
  period: '2026-Q1',
  totalProfit: 1000000,
  reinvestmentAmount: 400000,
  dividendPool: 400000,
  reserveAmount: 200000,
  perPartnerBreakdown: { 'pt-1': 50000 },
  createdBy: 'u-1',
  createdAt: '2026-04-01T00:00:00Z',
};

describe('PartnersApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the partner ledger with paging', async () => {
    const { http, service } = init();
    const promise = service.listPartners({ page: 1, limit: 10 });
    const req = http.expectOne('/api/v1/partners?page=1&limit=10');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [PARTNER], total: 1 });
    const result = await promise;
    expect(result.data[0].equityPercentage).toBe(12.5);
    expect(result.data[0].investedAmount).toBe(2500000);
  });

  it('flattens the nested user object the live API returns', async () => {
    const { http, service } = init();
    const promise = service.listPartners({ page: 1, limit: 50 });
    const req = http.expectOne('/api/v1/partners?page=1&limit=50');
    req.flush({
      data: [
        {
          id: 'pt-2',
          user: { id: 'u-9', name: 'Test Partner', email: 'partner@seentair.test' },
          equityPercentage: 10,
          investedAmount: 1000000,
          createdAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 1,
    });
    const result = await promise;
    expect(result.data[0].userName).toBe('Test Partner');
    expect(result.data[0].userEmail).toBe('partner@seentair.test');
    expect(result.data[0].userId).toBe('u-9');
  });

  it('GETs one partner via encode-safe id and POSTs a new partner', async () => {
    const { http, service } = init();
    const getPromise = service.getPartner('pt 1');
    const getReq = http.expectOne('/api/v1/partners/pt%201');
    expect(getReq.request.method).toBe('GET');
    getReq.flush(PARTNER);
    expect((await getPromise).userName).toBe('Ngozi Umeh');

    const input = { userId: 'u-8', equityPercentage: 12.5, investedAmount: 2500000 } as const;
    const createPromise = service.createPartner(input);
    const createReq = http.expectOne('/api/v1/partners');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(input);
    createReq.flush(PARTNER);
    await createPromise;
  });

  it('GETs profit distributions and POSTs one preserving the 40/40/20 split', async () => {
    const { http, service } = init();
    const listPromise = service.listDistributions({ page: 1, limit: 25 });
    const listReq = http.expectOne('/api/v1/profit-distributions?page=1&limit=25');
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ data: [DISTRIBUTION], total: 1 });
    const list = await listPromise;
    expect(list.data[0].reinvestmentAmount / list.data[0].totalProfit).toBe(0.4);
    expect(list.data[0].dividendPool / list.data[0].totalProfit).toBe(0.4);
    expect(list.data[0].reserveAmount / list.data[0].totalProfit).toBe(0.2);

    const input = {
      period: '2026-Q2',
      totalProfit: 800000,
      reinvestmentAmount: 320000,
      dividendPool: 320000,
      reserveAmount: 160000,
      perPartnerBreakdown: { 'pt-1': 40000 },
      createdBy: 'u-1',
    } as const;
    const createPromise = service.createDistribution(input);
    const createReq = http.expectOne('/api/v1/profit-distributions');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(input);
    createReq.flush({ ...DISTRIBUTION, period: '2026-Q2' });
    expect((await createPromise).period).toBe('2026-Q2');
  });

  it('GETs the per-partner dashboard aggregate', async () => {
    const { http, service } = init();
    const promise = service.getPartnerDashboard('pt-1');
    const req = http.expectOne('/api/v1/partners/pt-1/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({ partner: PARTNER, distributions: [DISTRIBUTION], totalInvested: 2500000, totalDistributed: 50000 });
    const result = await promise;
    expect(result.partner.id).toBe('pt-1');
    expect(result.totalInvested).toBe(2500000);
    expect(result.totalDistributed).toBe(50000);
  });
});
