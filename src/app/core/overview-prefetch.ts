import { Injectable, inject } from '@angular/core';
import {
  AnalyticsApiService,
  AnalyticsBestSeller,
  AnalyticsDashboard,
  AnalyticsInventoryMovementMonth,
  AnalyticsLowStock,
} from './analytics-api.service';

export interface OverviewPrefetchSlots {
  dashboard: Promise<AnalyticsDashboard | null>;
  bestSellers: Promise<AnalyticsBestSeller[]>;
  lowStock: Promise<AnalyticsLowStock | null>;
  inventoryMovements: Promise<AnalyticsInventoryMovementMonth[] | null>;
}

@Injectable({ providedIn: 'root' })
export class OverviewPrefetchService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private slots: OverviewPrefetchSlots | null = null;

  /** Start the four analytics calls once; each settles independently. */
  prefetch(): OverviewPrefetchSlots {
    if (!this.slots) {
      this.slots = {
        dashboard: this.analyticsApi.dashboard().catch(() => null),
        bestSellers: this.analyticsApi.bestSellers(5).catch(() => [] as AnalyticsBestSeller[]),
        lowStock: this.analyticsApi.lowStock().catch(() => null),
        inventoryMovements: this.analyticsApi
          .inventoryMovementTrend('weekly')
          .catch(() => null),
      };
    }
    return this.slots;
  }

  /** Hand the in-flight slots to the overview and forget them. */
  consume(): OverviewPrefetchSlots | null {
    const slots = this.slots;
    this.slots = null;
    return slots;
  }
}
