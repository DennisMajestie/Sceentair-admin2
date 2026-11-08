import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { ProductionApiService } from './production-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(ProductionApiService),
  };
}

const BATCH = {
  id: 'pb-1',
  variant: { id: 'var-1', sku: 'HD-BLK-M', size: 'M', colour: 'Black', priceOverride: null, imageUrl: null, availabilityStatus: 'available', storageLocation: 'R-01', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  quantity: 120,
  stage: 'Sewing',
  plannedDate: '2026-04-05',
  completedDate: null,
  approvalRequestId: 'ap-3',
  barcode: 'B-0771',
  createdBy: 'u-4',
  createdAt: '2026-04-02T00:00:00Z',
};

const COST = {
  id: 'cost-1',
  materialCost: 30000,
  sewingCost: 12000,
  brandingCost: 4000,
  packagingCost: 2000,
  confirmedComponents: ['material', 'sewing'],
  totalCost: 48000,
};

const REJECTION = {
  id: 'qc-1',
  quantity: 3,
  reason: 'Loose stitching',
  disposition: 'repaired_restocked',
  inspectorId: 'u-4',
  recordedBy: 'u-4',
  createdAt: '2026-04-06T00:00:00Z',
};

describe('ProductionApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs batches with optional stage filter', async () => {
    const { http, service } = init();
    const promise = service.list(1, 20, 'Sewing');
    const req = http.expectOne('/api/v1/production-batches?page=1&limit=20&stage=Sewing');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [BATCH], total: 1, stages: ['Production Planned', 'Cutting', 'Sewing', 'Finishing', 'Quality Control', 'Completed'] });
    const result = await promise;
    expect(result.data[0].stage).toBe('Sewing');
    expect(result.data[0].quantity).toBe(120);
    expect(result.stages).toHaveSize(6);
  });

  it('GETs batch detail, cost, rejections, scans, telemetry and bom subresources', async () => {
    const { http, service } = init();
    const detail = service.detail('pb 1');
    const detailReq = http.expectOne('/api/v1/production-batches/pb%201');
    detailReq.flush(BATCH);
    const cost = service.cost('pb-1');
    const costReq = http.expectOne('/api/v1/production-batches/pb-1/cost');
    costReq.flush(COST);
    const rejections = service.rejections('pb-1');
    const rejReq = http.expectOne('/api/v1/production-batches/pb-1/qc-rejections');
    rejReq.flush([REJECTION]);
    const scans = service.scans('pb-1');
    const scanReq = http.expectOne('/api/v1/production-batches/pb-1/scans');
    scanReq.flush([{ id: 's-1', stage: 'Cutting', scannedBy: 'u-4', scannedAt: '2026-04-04T00:00:00Z' }]);
    const telemetry = service.telemetry('pb-1');
    const telReq = http.expectOne('/api/v1/production-batches/pb-1/telemetry');
    telReq.flush([{ id: 't-1', metric: 'sewing_rate', value: 22, recordedAt: '2026-04-05T00:00:00Z' }]);
    const bom = service.bom('pb-1');
    const bomReq = http.expectOne('/api/v1/production-batches/pb-1/bom');
    bomReq.flush([{ materialId: 'm-1', materialName: 'Cotton fleece', unit: 'kg', plannedQuantity: 40, consumedQuantity: 38 }]);

    expect((await detail).id).toBe('pb-1');
    expect((await cost)?.totalCost).toBe(48000);
    expect((await rejections)[0].disposition).toBe('repaired_restocked');
    expect((await scans)[0].stage).toBe('Cutting');
    expect((await telemetry)[0].metric).toBe('sewing_rate');
    expect((await bom)[0].plannedQuantity).toBe(40);
  });

  it('PATCHes the batch stage (kanban advance)', async () => {
    const { http, service } = init();
    const promise = service.updateStage('pb-1', 'Finishing');
    const req = http.expectOne('/api/v1/production-batches/pb-1/stage');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ stage: 'Finishing' });
    req.flush({ ...BATCH, stage: 'Finishing' });
    expect((await promise).stage).toBe('Finishing');
  });

  it('POSTs a batch requiring an approval request id', async () => {
    const { http, service } = init();
    const input = { variantId: 'var-1', quantity: 120, plannedDate: '2026-04-05', approvalRequestId: 'ap-3' } as const;
    const promise = service.createBatch(input);
    const req = http.expectOne('/api/v1/production-batches');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(BATCH);
    expect((await promise).approvalRequestId).toBe('ap-3');
  });

  it('records cost, rejection, barcode and scans', async () => {
    const { http, service } = init();
    const costPromise = service.recordCost('pb-1', { materialCost: 30000, sewingCost: 12000, brandingCost: 4000, packagingCost: 2000 });
    const costReq = http.expectOne('/api/v1/production-batches/pb-1/cost');
    expect(costReq.request.method).toBe('POST');
    costReq.flush(COST);
    expect((await costPromise).totalCost).toBe(48000);

    const qcPromise = service.recordQcRejection('pb-1', { reason: 'Burned scorch marks', disposition: 'burned', quantity: 2 });
    const qcReq = http.expectOne('/api/v1/production-batches/pb-1/qc-rejection');
    expect(qcReq.request.method).toBe('POST');
    expect(qcReq.request.body).toEqual({ reason: 'Burned scorch marks', disposition: 'burned', quantity: 2 });
    qcReq.flush(REJECTION);
    expect((await qcPromise).disposition).toBe('repaired_restocked');

    const barcodePromise = service.registerBarcode('pb-1', 'B-0771');
    const barcodeReq = http.expectOne('/api/v1/production-batches/pb-1/barcode');
    expect(barcodeReq.request.method).toBe('POST');
    expect(barcodeReq.request.body).toEqual({ barcode: 'B-0771' });
    barcodeReq.flush({});
    expect(await barcodePromise).toBeUndefined();

    const scanPromise = service.recordScan('pb-1', { eventType: 'stage_scan', scannedQty: 20 });
    const scanReq = http.expectOne('/api/v1/production-batches/pb-1/scans');
    expect(scanReq.request.method).toBe('POST');
    scanReq.flush({});
    expect(await scanPromise).toBeUndefined();
  });
});
