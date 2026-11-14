import { Injectable, inject } from '@angular/core';
import {
  AnalyticsApiService,
  AnalyticsBestSeller,
  AnalyticsDashboard,
  AnalyticsInventoryMovementMonth,
  AnalyticsLowStock,
} from './analytics-api.service';

export interface OverviewPrefetchData {
  dashboard: AnalyticsDashboard | null;
  bestSellers: AnalyticsBestSeller[];
  lowStock: AnalyticsLowStock | null;
  inventoryMovements: AnalyticsInventoryMovementMonth[] | null;
}

@Injectable({ providedIn: 'root' })
export class OverviewPrefetchService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private pending: Promise<OverviewPrefetchData> | null = null;
  private cached: OverviewPrefetchData | null = null;

  prefetch(): Promise<OverviewPrefetchData> {
    if (!this.pending) {
      this.pending = this.load().then((data) => {
        this.cached = data;
        this.pending = null;
        return data;
      });
    }
    return this.pending;
  }

  consume(): OverviewPrefetchData | null {
    const data = this.cached;
    this.cached = null;
    return data;
  }

  private async load(): Promise<OverviewPrefetchData> {
    const [dashboard, bestSellers, lowStock, inventoryMovements] = await Promise.allSettled([
      this.analyticsApi.dashboard(),
      this.analyticsApi.bestSellers(5),
      this.analyticsApi.lowStock(),
      this.analyticsApi.inventoryMovementTrend('weekly'),
    ]);
    return {
      dashboard: dashboard.status === 'fulfilled' ? dashboard.value : null,
      bestSellers: bestSellers.status === 'fulfilled' ? bestSellers.value : [],
      lowStock: lowStock.status === 'fulfilled' ? lowStock.value : null,
      inventoryMovements: inventoryMovements.status === 'fulfilled' ? inventoryMovements.value : null,
    };
  }
}