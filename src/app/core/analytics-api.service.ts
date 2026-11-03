import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type AnalyticsRange = 'today' | '7d' | '30d' | 'custom';

export interface AnalyticsDashboard {
  salesToday: { orders: number; revenue: number };
  salesMonthToDate: { orders: number; revenue: number };
  profitLoss: unknown;
  salesByChannel: Array<{ channel: string; orders: number; revenue: number }>;
  marketingSourcePerformance: Array<{ source: string; orders: number; revenue: number }>;
  production: Array<{ stage: string; batches: number }>;
  pendingApprovals: number;
  inventory: {
    finishedGoodsUnits: number;
    stockedVariantCount: number;
    lowStockMaterialCount: number;
    lowStockMaterials: Array<{ id: string; name: string; currentQuantity: number; reorderThreshold: number }>;
  };
  range: { key: AnalyticsRange; from: string; to: string };
  metrics: { revenue: number; priorRevenue: number; openOrders: number; priorOpenOrders: number };
  series: Array<{ label: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  trends: { approvals: number[]; lowStock: number[] };
}

export interface AnalyticsBestSeller {
  variantId: string;
  sku: string;
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface AnalyticsLowStock {
  materials: Array<{ id: string; name: string; currentQuantity: number; reorderThreshold: number }>;
  variants: Array<{
    variantId: string;
    sku: string;
    productName: string;
    currentQuantity: number;
    reorderThreshold: number;
  }>;
  variantThreshold: number;
}

export interface AnalyticsInventoryValuation {
  finishedGoodsUnits: number;
  stockedVariantCount: number;
  totalValue: number | null;
  unvaluedUnits: number;
  unvaluedVariantCount: number;
  method: 'latest-recorded-completed-batch-cost';
}

export interface AnalyticsInventoryMovementMonth {
  label: string;
  stockIn: number;
  stockOut: number;
  unitsOnHand: number;
  stockInValue: number | null;
  stockOutValue: number | null;
  stockValue: number | null;
}

export type AnalyticsInventoryMovementPeriod = 'weekly' | 'monthly' | 'quarterly';

export interface AnalyticsFilters {
  range?: AnalyticsRange;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  dashboard(filters: AnalyticsFilters = {}): Promise<AnalyticsDashboard> {
    let params = new HttpParams();
    if (filters.range) params = params.set('range', filters.range);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return firstValueFrom(
      this.http.get<AnalyticsDashboard>(apiUrl(this.baseUrl, 'analytics/dashboard'), { params }),
    );
  }

  bestSellers(limit = 10, direction: 'best' | 'slow' = 'best'): Promise<AnalyticsBestSeller[]> {
    let params = new HttpParams()
      .set('limit', limit)
      .set('direction', direction);
    return firstValueFrom(
      this.http.get<AnalyticsBestSeller[]>(apiUrl(this.baseUrl, 'analytics/best-sellers'), { params }),
    );
  }

  lowStock(variantThreshold = 10): Promise<AnalyticsLowStock> {
    let params = new HttpParams().set('variantThreshold', variantThreshold);
    return firstValueFrom(
      this.http.get<AnalyticsLowStock>(apiUrl(this.baseUrl, 'analytics/low-stock'), { params }),
    );
  }

  inventoryValuation(): Promise<AnalyticsInventoryValuation> {
    return firstValueFrom(
      this.http.get<AnalyticsInventoryValuation>(
        apiUrl(this.baseUrl, 'analytics/inventory-valuation'),
      ),
    );
  }

  inventoryMovementTrend(
    period: AnalyticsInventoryMovementPeriod = 'monthly',
  ): Promise<AnalyticsInventoryMovementMonth[]> {
    const params = new HttpParams().set('period', period);
    return firstValueFrom(
      this.http.get<AnalyticsInventoryMovementMonth[]>(
        apiUrl(this.baseUrl, 'analytics/inventory-movement-trend'),
        { params },
      ),
    );
  }
}
