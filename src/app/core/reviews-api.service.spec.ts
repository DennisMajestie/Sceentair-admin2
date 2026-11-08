import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { ReviewsApiService } from './reviews-api.service';

const TEST_URL = '/api/v1';

function init() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [{ provide: API_BASE_URL, useValue: TEST_URL }],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(ReviewsApiService),
  };
}

const REVIEW = {
  id: 'rev-1',
  orderId: 'order-1',
  rating: 5,
  comment: 'Fabric quality is solid',
  status: 'pending',
  customerId: 'c-1',
  createdAt: '2026-05-01T00:00:00Z',
  variant: { id: 'var-1', sku: 'HD-BLK-M', size: 'M', colour: 'Black', product: { id: 'p-1', name: 'Hoodie' } },
};

describe('ReviewsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('GETs the pending moderation queue (delivered orders only upstream)', async () => {
    const { http, service } = init();
    const promise = service.pending();
    const req = http.expectOne('/api/v1/reviews/pending');
    expect(req.request.method).toBe('GET');
    req.flush([REVIEW]);
    const reviews = await promise;
    expect(reviews[0].rating).toBe(5);
    expect(reviews[0].status).toBe('pending');
    expect(reviews[0].variant?.product?.name).toBe('Hoodie');
  });

  it('PATCHes a publish moderation decision', async () => {
    const { http, service } = init();
    const promise = service.moderate('rev 1', 'published');
    const req = http.expectOne('/api/v1/reviews/rev%201/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'published' });
    req.flush({});
    await promise;
  });

  it('PATCHes a reject moderation decision', async () => {
    const { http, service } = init();
    const promise = service.moderate('rev-1', 'rejected');
    const req = http.expectOne('/api/v1/reviews/rev-1/status');
    expect(req.request.body).toEqual({ status: 'rejected' });
    req.flush({});
    await promise;
  });
});
