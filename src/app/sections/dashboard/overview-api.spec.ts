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
  salesMonthToDate: { orders: 18, revenue: 2400 },
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
    stockedVariantCount: 5,
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
  const api = jasmine.createSpyObj('AnalyticsApiService', [
    'dashboard',
    'bestSellers',
    'lowStock',
    'inventoryValuation',
    'inventoryMovementTrend',
  ]);
  api.dashboard.and.returnValue(Promise.resolve(dashboardResult));
  api.bestSellers.and.returnValue(Promise.resolve([
    { variantId: 'v-1', sku: 'MF-CRB-15', productName: 'Calendula Rescue Balm', unitsSold: 42, revenue: 840 },
    { variantId: 'v-2', sku: 'MF-CLO-30', productName: 'Camellia Cleansing Oil', unitsSold: 24, revenue: 432 },
  ]));
  api.lowStock.and.returnValue(Promise.resolve({
    materials: [
      { id: 'm-1', name: 'Shea butter', currentQuantity: 0, reorderThreshold: 20 },
      { id: 'm-2', name: 'Calendula oil', currentQuantity: 7, reorderThreshold: 10 },
    ],
    variants: [
      {
        variantId: 'v-1',
        sku: 'SKU-1',
        productName: 'Product 1',
        currentQuantity: 0,
        reorderThreshold: 10,
      },
      {
        variantId: 'v-2',
        sku: 'SKU-2',
        productName: 'Product 2',
        currentQuantity: 4,
        reorderThreshold: 10,
      },
    ],
    variantThreshold: 10,
  }));
  api.inventoryValuation.and.returnValue(Promise.resolve({
    finishedGoodsUnits: 3840,
    stockedVariantCount: 5,
    totalValue: 1234,
    unvaluedUnits: 0,
    unvaluedVariantCount: 0,
    method: 'latest-recorded-completed-batch-cost',
  }));
  api.inventoryMovementTrend.and.returnValue(Promise.resolve([
    {
      label: 'Oct 5',
      stockIn: 12,
      stockOut: 4,
      unitsOnHand: 3832,
      stockInValue: 1200,
      stockOutValue: 400,
      stockValue: 383200,
    },
    {
      label: 'Oct 12',
      stockIn: 8,
      stockOut: 0,
      unitsOnHand: 3840,
      stockInValue: 800,
      stockOutValue: 0,
      stockValue: 384000,
    },
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
      {
        provide: Router,
        useValue: {
          url: '',
          events: of(null),
          navigate: jasmine.createSpy('navigate'),
          createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({}),
          serializeUrl: jasmine.createSpy('serializeUrl').and.returnValue('/'),
        },
      },
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

    // Sales overview totals come from paid month-to-date API data, not today's metrics.
    expect((component as any).totalSales()).toBe(2400);
    expect((component as any).numberOfSales()).toBe(18);
    // Open orders from API metrics.openOrders
    expect((component as any).openOrders()).toBe(18);
    // Pending approvals from API pendingApprovals
    expect((component as any).pendingApprovals()).toBe(2);
    // Low stock count comes from low stock API
    expect((component as any).lowCount()).toBe(4);
  });

  it('uses the reference dashboard metric and chart labels', async () => {
    const fixture = createComponent(makeAnalyticsApi());
    await ((fixture.componentInstance as any).loadDashboard());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sales this month');
    expect(fixture.nativeElement.textContent).toContain('Open orders');
    expect(fixture.nativeElement.textContent).toContain('Pending approvals');
    expect(fixture.nativeElement.textContent).toContain('Inventory statistics');
    expect(fixture.nativeElement.textContent).toContain('Stock value');
    expect(fixture.nativeElement.textContent).toContain('Weekly');
    expect((fixture.componentInstance as any).count(1974)).toBe('1,974');
  });

  it('shows pending approvals as unavailable when null', async () => {
    const analyticsApi = makeAnalyticsApi({
      ...DASHBOARD,
      pendingApprovals: null as any,
    });
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    fixture.detectChanges();

    expect((component as any).pendingApprovals()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Pending approvals unavailable"]'),
    ).not.toBeNull();
  });

  it('does not show a fabricated sales goal when none is configured', async () => {
    const fixture = createComponent(makeAnalyticsApi());
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    fixture.detectChanges();

    expect((component as any).salesGoal()).toBeNull();
    expect((component as any).salesPctLabel()).toBe('—');
    expect(fixture.nativeElement.textContent).toContain(
      'Set a sales goal in settings to track progress.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('$24,500');
  });

  it('keeps successful dashboard metrics visible when one dashboard endpoint fails', async () => {
    const analyticsApi = makeAnalyticsApi();
    analyticsApi.lowStock.and.returnValue(Promise.reject(new Error('Low stock service unavailable')));
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    expect((component as any).totalSales()).toBe(2400);
    expect((component as any).openOrders()).toBe(18);
    expect((component as any).pendingApprovals()).toBe(2);
    expect((component as any).lowStockData()).toBeNull();
    expect((component as any).dashboardError()).toContain('Low stock service unavailable');
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

  it('maps weekly ledger movement data to stockTrendBars instead of sales revenue', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    const bars = (component as any).stockTrendBars();
    expect(bars).toEqual([
      {
        label: 'Oct 5',
        stockIn: 12,
        stockOut: 4,
        unitsOnHand: 3832,
        stockInValue: 1200,
        stockOutValue: 400,
        stockValue: 383200,
      },
      {
        label: 'Oct 12',
        stockIn: 8,
        stockOut: 0,
        unitsOnHand: 3840,
        stockInValue: 800,
        stockOutValue: 0,
        stockValue: 384000,
      },
    ]);
  });

  it('requests and displays the selected inventory movement period', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await (component as any).selectChartPeriod('quarterly');
    await fixture.whenStable();

    expect(analyticsApi.inventoryMovementTrend).toHaveBeenCalledWith('quarterly');
    expect((component as any).chartPeriod()).toBe('quarterly');
    expect((component as any).chartLoading()).toBe(false);
    expect((component as any).chartError()).toBeNull();
  });

  it('shows unit movement instead of $0 when no movement is valued', async () => {
    const analyticsApi = makeAnalyticsApi();
    analyticsApi.inventoryMovementTrend.and.returnValue(Promise.resolve([
      {
        label: 'Oct 5',
        stockIn: 0,
        stockOut: 0,
        unitsOnHand: 3,
        stockInValue: 0,
        stockOutValue: 0,
        stockValue: null,
      },
      {
        label: 'Oct 12',
        stockIn: 0,
        stockOut: 0,
        unitsOnHand: 3,
        stockInValue: 0,
        stockOutValue: 0,
        stockValue: null,
      },
    ]));
    const fixture = createComponent(analyticsApi);

    await (fixture.componentInstance as any).loadDashboard();
    fixture.detectChanges();

    const summary = fixture.nativeElement
      .querySelector('.bars__summary')
      .textContent.replace(/\s+/g, ' ');
    expect(summary).toContain('0 units in');
    expect(summary).toContain('0 units out');
    expect(summary).toContain('net 0 units');
    expect(summary).not.toContain('$0');
    expect(summary).toContain('value unavailable');
  });

  it('does not present Store data as sales while the API data is not loaded', async () => {
    const analyticsApi = makeAnalyticsApi();
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    // Before loadDashboard completes
    expect((component as any).lowCount()).toBeNull();
    expect((component as any).totalSales()).toBeNull();
    expect((component as any).numberOfSales()).toBeNull();
    expect((component as any).pendingApprovals()).toBeNull();
    expect((component as any).openOrders()).toBe((component as any).store.openOrders().length);
    expect((component as any).sellers()).toEqual([]);
  });

  it('falls back to Store data when API returns null data', async () => {
    const analyticsApi = makeAnalyticsApi();
    analyticsApi.dashboard.and.returnValue(Promise.resolve(null as any));
    const fixture = createComponent(analyticsApi);
    const component = fixture.componentInstance;

    await (component as any).loadDashboard();
    await fixture.whenStable();

    expect((component as any).totalSales()).toBeNull();
    expect((component as any).numberOfSales()).toBeNull();
    expect((component as any).pendingApprovals()).toBeNull();
    expect((component as any).openOrders()).toBe((component as any).store.openOrders().length);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sales data unavailable');
  });
});
