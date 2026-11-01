import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  AnalyticsDashboard,
  AnalyticsApiService,
} from '../../core/analytics-api.service';
import { DashboardOverview } from './overview';
import { Store } from '../../core/store';

const DASHBOARD: AnalyticsDashboard = {
  salesToday: { orders: 12, revenue: 1450 },
  profitLoss: {},
  salesByChannel: [
    { channel: 'online', orders: 8, revenue: 960 },
    { channel: 'wholesale', orders: 3, revenue: 390 },
    { channel: 'studio', orders: 1, revenue: 100 },
  ],
  marketingSourcePerformance: [],
  production: [{ stage: 'cutting', batches: 4 }],
  pendingApprovals: 2,
  inventory: {
    finishedGoodsUnits: 3840,
    lowStockMaterialCount: 3,
    lowStockMaterials: [
      { id: 'm-1', name: 'Shea butter', currentQuantity: 46, reorderThreshold: 20 },
      { id: 'm-2', name: 'Calendula oil', currentQuantity: 7, reorderThreshold: 10 },
    ],
  },
  range: { key: 'today', from: '2026-01-15', to: '2026-01-15' },
  metrics: { revenue: 1450, priorRevenue: 1200, openOrders: 18, priorOpenOrders: 14 },
  series: [
    { label: 'Mon', revenue: 120, orders: 3 },
    { label: 'Tue', revenue: 340, orders: 8 },
    { label: 'Wed', revenue: 990, orders: 12 },
  ],
  statusBreakdown: [
    { status: 'order_received', count: 6 },
    { status: 'processing', count: 8 },
    { status: 'shipped', count: 3 },
  ],
  trends: { approvals: [1, 2, 2], lowStock: [0, 1, 3] },
};

function makeAnalyticsApi(dashboardResult: AnalyticsDashboard = DASHBOARD) {
  const api = jasmine.createSpyObj('AnalyticsApiService', ['dashboard', 'bestSellers', 'lowStock']);
  api.dashboard.and.returnValue(Promise.resolve(dashboardResult));
  api.bestSellers.and.returnValue(Promise.resolve([
    { variantId: 'v-1', sku: 'MF-CRB-15', productName: 'Calendula Rescue Balm', unitsSold: 42, revenue: 840 },
    { variantId: 'v-2', sku: 'MF-CLO-30', productName: 'Camellia Cleansing Oil', unitsSold: 24, revenue: 432 },
  ]));
  return api;
}

function createComponent(analyticsApi: ReturnType<typeof makeAnalyticsApi>) {
  TestBed.configureTestingModule({
    imports: [DashboardOverview, HttpClientTestingModule],
    providers: [
      { provide: AnalyticsApiService, useValue: analyticsApi },
      { provide: Store, useClass: Store },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(DashboardOverview);
}

describe('dashboard API response mapping', () => {
  it('maps API metrics to view-model computeds', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    const data = (component as any).dashboardData();
    expect(data).not.toBeNull();

    // Units from API inventory.finishedGoodsUnits
    expect((component as any).units()).toBe(3840);
    // Total sales from API metrics.revenue
    expect((component as any).totalSales()).toBe(1450);
    // Number of sales from API salesToday.orders
    expect((component as any).numberOfSales()).toBe(12);
    // Open orders from API metrics.openOrders
    expect((component as any).openOrders()).toBe(18);
    // Low count from API inventory.lowStockMaterialCount
    expect((component as any).lowCount()).toBe(3);
  });

  it('maps API bestSellers to seller rows', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    const sellers = (component as any).sellers();
    expect(sellers.length).toBe(2);
    expect(sellers[0]).toEqual(
      jasmine.objectContaining({
        id: 'v-1',
        name: 'Calendula Rescue Balm',
        sku: 'MF-CRB-15',
        units: 42,
        revenue: 840,
        photo: '',
      }),
    );
    expect(sellers[1]).toEqual(
      jasmine.objectContaining({
        id: 'v-2',
        name: 'Camellia Cleansing Oil',
        sku: 'MF-CLO-30',
        units: 24,
        revenue: 432,
        photo: '',
      }),
    );
  });

  it('maps API salesByChannel to channel bars', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    const bars = (component as any).channelBars();
    expect(bars.length).toBe(3);
    expect(bars[0]).toEqual(jasmine.objectContaining({ label: 'Online', value: 8 }));
    expect(bars[1]).toEqual(jasmine.objectContaining({ label: 'Wholesale', value: 3 }));
    expect(bars[2]).toEqual(jasmine.objectContaining({ label: 'Studio', value: 1 }));
  });

  it('maps API series to stockTrendBars', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    const bars = (component as any).stockTrendBars();
    expect(bars.length).toBe(3);
    expect(bars[0]).toEqual(jasmine.objectContaining({ label: 'Mon', value: 120, in: 0, out: 0 }));
    expect(bars[1]).toEqual(jasmine.objectContaining({ label: 'Tue', value: 340, in: 0, out: 0 }));
    expect(bars[2]).toEqual(jasmine.objectContaining({ label: 'Wed', value: 990, in: 0, out: 0 }));
  });

  it('falls back to Store data when API data is not loaded', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    // Before loadDashboard completes
    expect((component as any).units()).toBe((component as any).store.unitsOnHand());
    expect((component as any).totalSales()).toBe(
      (component as any).store.orders().reduce(
        (total: number, o: any) =>
          o.status === 'cancelled' ? total : total + o.lines.reduce((a: number, l: any) => a + l.qty * l.price, 0),
        0,
      ),
    );
    expect((component as any).numberOfSales()).toBe(
      (component as any).store.orders().filter((o: any) => o.status !== 'cancelled').length,
    );
    expect((component as any).openOrders()).toBe((component as any).store.openOrders().length);
    expect((component as any).lowCount()).toBe((component as any).store.lowStock().length);
    expect((component as any).sellers()).toEqual([]);
  });

  it('falls back to Store data when API returns null data', async () => {
    const analyticsApi = makeAnalyticsApi();
    analyticsApi.dashboard.and.returnValue(Promise.resolve(null as any));
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    expect((component as any).units()).toBe((component as any).store.unitsOnHand());
    expect((component as any).totalSales()).toBe(
      (component as any).store.orders().reduce(
        (total: number, o: any) =>
          o.status === 'cancelled' ? total : total + o.lines.reduce((a: number, l: any) => a + l.qty * l.price, 0),
        0,
      ),
    );
  });
});
