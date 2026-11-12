import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';
import { normalizeList } from './api-shape';

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
  material: ApiMaterial;
  quantity: number;
  cost: number;
  note: string | null;
  supplierName: string | null;
  leadTimeDays: number | null;
  recordedBy: string | null;
  purchasedAt: string;
}

export interface ApiPurchaseList {
  data: ApiPurchase[];
  total: number;
}

export interface RecordPurchaseInput {
  materialId: string;
  quantity: number;
  cost: number;
  supplierName?: string | null;
  leadTimeDays?: number | null;
  note?: string | null;
  recordedBy?: string | null;
  purchasedAt?: string | null;
  approvalRequestId?: string;
}

export interface RecordUsageInput {
  materialId: string;
  quantity: number;
  note?: string | null;
  recordedBy?: string | null;
  usedAt?: string | null;
  batchId?: string | null;
}

export interface CreateMaterialInput {
  name: string;
  unit: string;
  category?: string | null;
  storageLocation?: string | null;
  reorderThreshold?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MaterialsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiMaterialFilters = { page: 1, limit: 100 }): Promise<ApiMaterialList> {
    const params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ApiMaterialList | ApiMaterial[]>(apiUrl(this.baseUrl, 'materials'), { params }),
    ).then((result) => normalizeList<ApiMaterial>(result));
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

  create(input: CreateMaterialInput): Promise<ApiMaterial> {
    return firstValueFrom(
      this.http.post<ApiMaterial>(apiUrl(this.baseUrl, 'materials'), input),
    );
  }

  purchase(input: RecordPurchaseInput): Promise<ApiPurchase> {
    const { materialId, ...body } = input;
    return firstValueFrom(
      this.http.post<ApiPurchase>(
        apiUrl(this.baseUrl, `materials/${encodeURIComponent(materialId)}/purchase`),
        body,
      ),
    );
  }

  usage(input: RecordUsageInput): Promise<ApiMaterial> {
    return firstValueFrom(
      this.http.post<ApiMaterial>(
        apiUrl(this.baseUrl, `materials/${encodeURIComponent(input.materialId)}/usage`),
        input,
      ),
    );
  }
}