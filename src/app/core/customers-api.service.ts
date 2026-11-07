import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type ApiCustomerKind = 'stockist' | 'shopper';

export interface ApiCustomer {
  id: string;
  name: string;
  kind: ApiCustomerKind;
  contact: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  since: string;
  tags: string[];
  note: string;
}

export interface ApiCustomerList {
  data: ApiCustomer[];
  total: number;
}

export interface ApiCustomerFilters {
  page: number;
  limit: number;
  kind?: ApiCustomerKind;
}

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiCustomerFilters): Promise<ApiCustomerList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.kind) params = params.set('kind', filters.kind);
    return firstValueFrom(
      this.http.get<ApiCustomerList>(apiUrl(this.baseUrl, 'customers'), { params }),
    );
  }

  detail(id: string): Promise<ApiCustomer> {
    return firstValueFrom(
      this.http.get<ApiCustomer>(apiUrl(this.baseUrl, `customers/${encodeURIComponent(id)}`)),
    );
  }
}
