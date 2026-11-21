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
