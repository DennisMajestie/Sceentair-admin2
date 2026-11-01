import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type MaterialKind =
  | 'fabrics'
  | 'trims_hardware'
  | 'thread'
  | 'packaging'
  | 'printing'
  | 'labels'
  | 'other'
  | null;

export interface ApiMaterial {
  id: string;
  name: string;
  unit: string;
  category: MaterialKind;
  storageLocation: string | null;
  reorderThreshold: number;
  createdAt: string;
  currentQuantity: number;
  lowStock: boolean;
}

export interface ApiMaterialValuation extends ApiMaterial {
  lastUnitCost: number | null;
  lastPurchaseAt: string | null;
  currentValue: number;
}

export interface ApiMaterialList {
  data: ApiMaterial[];
  total: number;
}

export interface ApiMaterialFilters {
  page: number;
  limit: number;
}

export interface ApiPurchase {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  cost: number;
  supplierName: string | null;
  purchaseDate: string;
  recordedBy: string | null;
}

export interface ApiPurchaseList {
  data: ApiPurchase[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class MaterialsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiMaterialFilters = { page: 1, limit: 100 }): Promise<ApiMaterialList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ApiMaterialList>(apiUrl(this.baseUrl, 'materials'), { params }),
    );
  }

  purchases(page = 1, limit = 50): Promise<ApiPurchaseList> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    return firstValueFrom(
      this.http.get<ApiPurchaseList>(apiUrl(this.baseUrl, 'materials/purchases'), { params }),
    );
  }

  lowStock(): Promise<ApiMaterial[]> {
    return firstValueFrom(
      this.http.get<ApiMaterial[]>(apiUrl(this.baseUrl, 'materials/low-stock')),
    );
  }

  valuation(): Promise<ApiMaterialValuation[]> {
    return firstValueFrom(
      this.http.get<ApiMaterialValuation[]>(apiUrl(this.baseUrl, 'materials/valuation')),
    );
  }

  detail(id: string): Promise<ApiMaterial> {
    return firstValueFrom(
      this.http.get<ApiMaterial>(apiUrl(this.baseUrl, `materials/${encodeURIComponent(id)}`)),
    );
  }
}