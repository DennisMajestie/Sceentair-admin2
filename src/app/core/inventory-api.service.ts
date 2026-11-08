import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type InventoryItemType = 'variant' | 'material';

export interface ApiInventorySummaryItem {
  itemType: string;
  itemId: string;
  currentQuantity: number;
  byMovementType: Record<string, number>;
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

export type InventoryMovementType =
  | 'purchase'
  | 'production'
  | 'sale'
  | 'return'
  | 'damage'
  | 'dispatch'
  | 'adjustment';

export interface ApiInventoryMovement {
  id: string;
  movementType: InventoryMovementType;
  quantityDelta: number;
  timestamp: string;
  referenceId: string | null;
}

export interface ApiMovementList {
  data: ApiInventoryMovement[];
  total: number;
  currentQuantity: number;
}

export interface ApiMovementInput {
  movementType: InventoryMovementType;
  quantityDelta: number;
  referenceId?: string;
  approvalRequestId?: string;
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

  summary(): Promise<ApiInventorySummaryItem[]> {
    return firstValueFrom(
      this.http.get<ApiInventorySummaryItem[]>(apiUrl(this.baseUrl, 'inventory/summary')),
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
  ): Promise<ApiMovementList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit)
      .set('itemType', itemType);
    return firstValueFrom(
      this.http.get<ApiMovementList>(
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

  /** Record a manual stock movement (in/out) against an item. */
  recordMovement(
    itemType: InventoryItemType,
    itemId: string,
    body: ApiMovementInput,
  ): Promise<ApiInventoryMovement> {
    return firstValueFrom(
      this.http.post<ApiInventoryMovement>(
        apiUrl(this.baseUrl, `inventory/${encodeURIComponent(itemId)}/movements`),
        body,
        { params: new HttpParams().set('itemType', itemType) },
      ),
    );
  }

  /** Hash-chain integrity badge for the whole inventory ledger. */
  ledgerVerify(): Promise<{ total: number; valid: number; broken: number; headHash: string | null }> {
    return firstValueFrom(
      this.http.get<{ total: number; valid: number; broken: number; headHash: string | null }>(
        apiUrl(this.baseUrl, 'inventory/ledger/verify'),
      ),
    );
  }
}