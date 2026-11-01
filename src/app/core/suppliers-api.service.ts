import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiSupplier {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  certified: boolean;
  slaScore: number | null;
  quotaUnits: number | null;
  complianceNotes: string | null;
  createdAt: string;
}

export interface ApiSupplierList {
  data: ApiSupplier[];
  total: number;
}

export interface ApiSupplierFilters {
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class SuppliersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiSupplierFilters = { page: 1, limit: 100 }): Promise<ApiSupplierList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ApiSupplierList>(apiUrl(this.baseUrl, 'materials/suppliers'), { params }),
    );
  }

  detail(id: string): Promise<ApiSupplier> {
    return firstValueFrom(
      this.http.get<ApiSupplier>(
        apiUrl(this.baseUrl, `materials/suppliers/${encodeURIComponent(id)}`)),
    );
  }
}
