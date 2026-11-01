import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type InventoryItemType = 'VARIANT' | 'MATERIAL';

export interface ApiInventorySummaryItem {
  itemType: string;
  itemId: string;
  currentQuantity: number;
  byMovementType: Record<string, number>;
}

export interface ApiInventorySummary {
  data: ApiInventorySummaryItem[];
  total: number;
}

export interface ApiInventoryDigest {
  itemType: InventoryItemType;
  itemId: string;
  currentQuantity: number;
  entryCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  ledgerHead: string | null;
}

export interface ApiInventoryFilters {
  page: number;
  limit: number;
  itemType?: InventoryItemType;
}

export interface ApiCountLine {
  itemType: 'variant' | 'material';
  itemId: string;
  countedQuantity: number;
  approvalRequestId: string | null;
}

export interface ApiCountRequest {
  items: ApiCountLine[];
}

export interface ApiCount {
  id: string;
  number: string;
  status: 'scheduled' | 'counting' | 'done';
  lines: ApiCountLine[];
  createdAt: string;
}

export interface ApiCountList {
  data: ApiCount[];
  total: number;
}

export interface ApiCountFilters {
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  summary(filters: ApiInventoryFilters = { page: 1, limit: 100 }): Promise<ApiInventorySummary> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.itemType) params = params.set('itemType', filters.itemType);
    return firstValueFrom(
      this.http.get<ApiInventorySummary>(apiUrl(this.baseUrl, 'inventory/summary'), { params }),
    );
  }

  digest(itemType: InventoryItemType, itemId: string): Promise<ApiInventoryDigest> {
    return firstValueFrom(
      this.http.get<ApiInventoryDigest>(
        apiUrl(this.baseUrl, `inventory/digest/${itemType}/${encodeURIComponent(itemId)}`),
      ),
    );
  }

  movements(
    itemType: InventoryItemType,
    itemId: string,
    filters: ApiInventoryFilters = { page: 1, limit: 50 },
  ): Promise<{ data: unknown[]; total: number; currentQuantity: number }> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit)
      .set('itemType', itemType);
    return firstValueFrom(
      this.http.get<{ data: unknown[]; total: number; currentQuantity: number }>(
        apiUrl(this.baseUrl, `inventory/${encodeURIComponent(itemId)}/movements`),
        { params },
      ),
    );
  }

  counts(filters: ApiCountFilters = { page: 1, limit: 50 }): Promise<ApiCountList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ApiCountList>(apiUrl(this.baseUrl, 'inventory/counts'), { params }),
    );
  }

  recordCount(request: ApiCountRequest): Promise<ApiCount> {
    return firstValueFrom(
      this.http.post<ApiCount>(apiUrl(this.baseUrl, 'inventory/counts'), request),
    );
  }
}