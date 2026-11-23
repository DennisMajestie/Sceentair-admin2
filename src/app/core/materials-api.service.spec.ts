import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { MaterialsApiService } from './materials-api.service';

describe('MaterialsApiService update', () => {
  let http: HttpTestingController;
  let service: MaterialsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: '/api/v1' }],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MaterialsApiService);
  });

  afterEach(() => http.verify());

  it('PATCHes master details only to the material resource', async () => {
    const result = service.update('m 1', { unit: 'yards', category: null });
    const request = http.expectOne('/api/v1/materials/m%201');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ unit: 'yards', category: null });

    request.flush({ id: 'm 1', unit: 'yards' });
    await expectAsync(result).toBeResolved();
  });
});

describe('MaterialsApiService purchases', () => {
  let http: HttpTestingController;
  let service: MaterialsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: '/api/v1' }],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MaterialsApiService);
  });

  afterEach(() => http.verify());

  it('reads the paginated purchase envelope', async () => {
    const result = service.purchases(2, 10);
    http.expectOne('/api/v1/materials/purchases?page=2&limit=10').flush({
      data: [{ id: 'p-1', quantity: 4, cost: 1200 }],
      total: 7,
    });

    const list = await result;
    expect(list.data.length).toBe(1);
    expect(list.total).toBe(7);
  });

  it('reads a bare purchase array without claiming zero records', async () => {
    const result = service.purchases();
    http.expectOne('/api/v1/materials/purchases?page=1&limit=50').flush([
      { id: 'p-1', quantity: 4, cost: 1200 },
      { id: 'p-2', quantity: 2, cost: 600 },
    ]);

    const list = await result;
    expect(list.data.length).toBe(2);
    expect(list.total).toBe(2);
  });
});
