import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { TechPacksApiService } from './tech-packs-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(TechPacksApiService),
  };
}

const PACK = {
  id: 'tp-1',
  variant: { id: 'var-1', sku: 'HD-BLK-M', size: 'M', colour: 'Black', product: { id: 'p-1', name: 'Hoodie', category: 'tops' } },
  silhouette: 'drop-shoulder',
  targetYieldUnits: 220,
  cuttingEfficiencyPct: 86,
  gradedMeasurements: { M: { chest: '58', length: '70' } },
  stitchProtocol: 'double-needle hem',
  laydownProtocol: 'single-layer',
  dxfUrl: null,
  revision: 3,
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  updatedBy: 'u-4',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  revisionCount: 3,
};

describe('TechPacksApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the tech pack list', async () => {
    const { http, service } = init();
    const promise = service.list();
    const req = http.expectOne('/api/v1/tech-packs');
    expect(req.request.method).toBe('GET');
    req.flush([PACK]);
    const packs = await promise;
    expect(packs[0].silhouette).toBe('drop-shoulder');
    expect(packs[0].cuttingEfficiencyPct).toBe(86);
    expect(packs[0].revisionCount).toBe(3);
  });

  it('GETs detail and revisions with encode-safe ids', async () => {
    const { http, service } = init();
    const detailPromise = service.detail('tp 1');
    const detailReq = http.expectOne('/api/v1/tech-packs/tp%201');
    detailReq.flush(PACK);
    const revisionsPromise = service.revisions('tp 1');
    const revReq = http.expectOne('/api/v1/tech-packs/tp%201/revisions');
    expect(revReq.request.method).toBe('GET');
    revReq.flush([{ id: 'tr-1', revision: 2, status: 'superseded', createdAt: '2026-03-20T00:00:00Z' }]);
    expect((await detailPromise).status).toBe('draft');
    expect((await revisionsPromise)[0].revision).toBe(2);
  });

  it('POSTs a tech pack creation, PUTs updates and POSTs approval', async () => {
    const { http, service } = init();
    const createInput = { variantId: 'var-1', silhouette: 'relaxed', targetYieldUnits: 200 } as const;
    const createPromise = service.create(createInput);
    const createReq = http.expectOne('/api/v1/tech-packs');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(createInput);
    createReq.flush(PACK);
    expect((await createPromise).id).toBe('tp-1');

    const updateInput = { stitchProtocol: 'flatlock' } as const;
    const updatePromise = service.update('tp-1', updateInput);
    const updateReq = http.expectOne('/api/v1/tech-packs/tp-1');
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.body).toEqual(updateInput);
    updateReq.flush({ ...PACK, stitchProtocol: 'flatlock', revision: 4 });
    expect((await updatePromise).revision).toBe(4);

    const approvePromise = service.approve('tp-1');
    const approveReq = http.expectOne('/api/v1/tech-packs/tp-1/approve');
    expect(approveReq.request.method).toBe('POST');
    expect(approveReq.request.body).toEqual({});
    approveReq.flush({ ...PACK, status: 'approved', approvedBy: 'u-1', approvedAt: '2026-04-02T00:00:00Z' });
    expect((await approvePromise).status).toBe('approved');
  });
});
