import { ChangeDetectionStrategy, Component, computed, inject, ElementRef, NgZone, Injector, effect, signal, DestroyRef, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, dateFull, money as fmtMoney, moneyCompact, relative, statusTone, statusLabel, until } from '../../core/format';
import { Bars, Gauge } from '../../ui/chart';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import { ChartPeriodSelect } from './chart-period-select';
import { Spinner } from '../../ui/spinner';
import { SdMotionService } from '../../core/sd-motion.service';
import { AuthService } from '../../core/auth.service';
import { gsap } from 'gsap';
import { hideAppPreloader } from '../../core/app-preloader';
import { OverviewPrefetchService } from '../../core/overview-prefetch';
import {
  AnalyticsInventoryMovementMonth,
  AnalyticsInventoryMovementPeriod,
  AnalyticsDashboard,
  AnalyticsLowStock,
  AnalyticsApiService,
} from '../../core/analytics-api.service';

const LOCATION_COLORS = ['var(--pine)', 'var(--ocean)', 'var(--ochre)', 'var(--sage)'];

export interface OverviewPresence {
  welcome: boolean;
  sales: boolean;
  open: boolean;
  approvals: boolean;
  chart: boolean;
  gauge: boolean;
  activities: boolean;
  alerts: boolean;
  sellers: boolean;
  ships: boolean;
  locations: boolean;
}

export interface OverviewSpans {
  welcome: string;
  sales: string;
  open: string;
  approvals: string;
  chart: string;
  gauge: string;
  activities: string;
  alerts: string;
  sellers: string;
  ships: string;
  locations: string;
}

export function computeOverviewSpans(p: OverviewPresence): OverviewSpans {
  const figureKeys = ['sales', 'open', 'approvals'] as const;
  const visibleFigures = figureKeys.filter((key) => p[key]);
  const welcomeSpan = p.welcome ? (visibleFigures.length ? 3 : 12) : 0;
  const figureSpace = (p.welcome ? 12 - welcomeSpan : 12);
  const baseFigureSpan = visibleFigures.length
    ? Math.floor(figureSpace / visibleFigures.length)
    : 0;
  const extraFigureSpans = visibleFigures.length
    ? figureSpace % visibleFigures.length
    : 0;
  const figureSpans = new Map(
    visibleFigures.map((key, index) => [
      key,
      baseFigureSpan + (index < extraFigureSpans ? 1 : 0),
    ] as const),
  );

  const row2 = (p.chart ? 1 : 0) + (p.gauge ? 1 : 0);
  const row3 = [p.activities, p.alerts, p.sellers].filter(Boolean).length;
  const row4 = (p.ships ? 1 : 0) + (p.locations ? 1 : 0);
  const r3 = (present: boolean) =>
    present ? (row3 === 3 ? 'span 4' : row3 === 2 ? 'span 6' : 'span 12') : '';

  return {
    welcome: welcomeSpan ? `span ${welcomeSpan}` : '',
    sales: p.sales ? `span ${figureSpans.get('sales')}` : '',
    open: p.open ? `span ${figureSpans.get('open')}` : '',
    approvals: p.approvals ? `span ${figureSpans.get('approvals')}` : '',
    chart: p.chart ? (row2 === 2 ? 'span 8' : 'span 12') : '',
    gauge: p.gauge ? (row2 === 2 ? 'span 4' : 'span 12') : '',
    activities: r3(p.activities),
    alerts: r3(p.alerts),
    sellers: r3(p.sellers),
    ships: p.ships ? (row4 === 2 ? 'span 7' : 'span 12') : '',
    locations: p.locations ? (row4 === 2 ? 'span 5' : 'span 12') : '',
  };
}

@Component({
  selector: 'app-dashboard-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Bars, Gauge, Icon, ProductShot, ChartPeriodSelect, Spinner],
  host: {
    '[class.sd-pending]': 'pending()',
    '[style.--ov-welcome]': 'spans().welcome',
    '[style.--ov-sales]': 'spans().sales',
    '[style.--ov-open]': 'spans().open',
    '[style.--ov-approvals]': 'spans().approvals',
    '[style.--ov-chart]': 'spans().chart',
    '[style.--ov-gauge]': 'spans().gauge',
    '[style.--ov-acts]': 'spans().activities',
    '[style.--ov-alerts]': 'spans().alerts',
    '[style.--ov-top]': 'spans().sellers',
    '[style.--ov-ships]': 'spans().ships',
    '[style.--ov-loc]': 'spans().locations',
  },
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class DashboardOverview {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private injector = inject(Injector);
  private motion = inject(SdMotionService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);
  private prefetch = inject(OverviewPrefetchService);

  protected pending = signal(true);
  protected readonly store = inject(Store);
  protected readonly analyticsApi = inject(AnalyticsApiService);
  protected readonly dashboardData = signal<AnalyticsDashboard | null>(null);
  protected readonly dashboardBestSellers = signal<any[]>([]);
  protected readonly lowStockData = signal<AnalyticsLowStock | null>(null);
  protected readonly inventoryMovements = signal<AnalyticsInventoryMovementMonth[] | null>(null);
  protected readonly dashboardError = signal<string | null>(null);
  protected readonly dashboardErrors = signal<{ label: string; message: string }[]>([]);
  protected readonly chartError = signal<string | null>(null);
  protected readonly chartLoading = signal(false);
  protected readonly chartPeriod = signal<AnalyticsInventoryMovementPeriod>('weekly');
  protected readonly chartExpanded = signal(false);
  private chartRequest = 0;
  private played = false;
  private entranceDone = false;
  private mm?: gsap.MatchMedia;

  constructor() {
    const prefetched = this.prefetch.consume();
    if (prefetched) {
      this.dashboardData.set(prefetched.dashboard);
      this.dashboardBestSellers.set(prefetched.bestSellers);
      this.lowStockData.set(prefetched.lowStock);
      this.inventoryMovements.set(prefetched.inventoryMovements);
      this.pending.set(false);
      hideAppPreloader();
    }
    effect(() => {
      this.store.data();
      afterNextRender(() => this.onData(), { injector: this.injector });
    });
    effect(() => {
      if (!this.dashboardData()) return;
      afterNextRender(() => {
        if (this.entranceDone) this.animateNumbers();
      }, { injector: this.injector });
    });
    this.destroyRef.onDestroy(() => this.mm?.revert());
    if (!prefetched) void this.loadDashboard();
  }
  private sellerPhoto(sku: string, productName: string): string {
    const products = this.store.products();
    return products.find((product) => product.sku === sku)?.photo
      ?? products.find((product) => product.name === productName)?.photo
      ?? '';
  }



  private async loadDashboard(): Promise<void> {
    this.pending.set(true);
    this.dashboardError.set(null);
    this.dashboardErrors.set([]);
    const [dashboard, bestSellers, lowStock, inventoryMovements] = await Promise.allSettled([
      this.analyticsApi.dashboard(),
      this.analyticsApi.bestSellers(5),
      this.analyticsApi.lowStock(),
      this.analyticsApi.inventoryMovementTrend(this.chartPeriod()),
    ]);
    const errors: string[] = [];
    const errorItems: { label: string; message: string }[] = [];
    if (dashboard.status === 'fulfilled') this.dashboardData.set(dashboard.value);
    else {
      this.dashboardData.set(null);
      const msg = this.errorMessage(dashboard.reason);
      errors.push(`Inventory totals: ${msg}`);
      errorItems.push({ label: 'Inventory totals', message: msg });
    }
    if (bestSellers.status === 'fulfilled') this.dashboardBestSellers.set(bestSellers.value);
    else {
      this.dashboardBestSellers.set([]);
      const msg = this.errorMessage(bestSellers.reason);
      errors.push(`Best sellers: ${msg}`);
      errorItems.push({ label: 'Best sellers', message: msg });
    }
    if (lowStock.status === 'fulfilled') this.lowStockData.set(lowStock.value);
    else {
      this.lowStockData.set(null);
      const msg = this.errorMessage(lowStock.reason);
      errors.push(`Low-stock items: ${msg}`);
      errorItems.push({ label: 'Low-stock items', message: msg });
    }
    if (inventoryMovements.status === 'fulfilled') this.inventoryMovements.set(inventoryMovements.value);
    else {
      this.inventoryMovements.set(null);
      const msg = this.errorMessage(inventoryMovements.reason);
      this.chartError.set(msg);
      errors.push(`Inventory movement chart: ${msg}`);
      errorItems.push({ label: 'Inventory movement chart', message: msg });
    }
    this.dashboardErrors.set(errorItems);
    this.dashboardError.set(
      errors.length ? `Some dashboard data could not be loaded. ${errors.join(' ')}` : null,
    );
    this.pending.set(false);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  /** Dashboard aggregates from the API. */
  protected readonly apiUnits = computed(() => this.dashboardData()?.inventory.finishedGoodsUnits ?? null);
  protected readonly apiLowCount = computed(() => this.dashboardData()?.inventory.lowStockMaterialCount ?? null);
  protected readonly apiOpenOrders = computed(() => this.dashboardData()?.metrics.openOrders ?? null);
  protected readonly apiTotalSales = computed(() => this.dashboardData()?.salesMonthToDate.revenue ?? null);
  protected readonly apiNumberOfSales = computed(() => this.dashboardData()?.salesMonthToDate.orders ?? null);
  protected readonly apiSellers = computed(() => this.dashboardBestSellers().map((s) => {
    return {
      id: s.variantId,
      name: s.productName,
      sku: s.sku,
      units: s.unitsSold,
      revenue: s.revenue,
      photo: this.sellerPhoto(s.sku, s.productName),
    };
  }));

  private onData() {
    if (!this.motion.isBrowser) {
      this.pending.set(false);
      this.snapNumbers();
      return;
    }
    if (this.played) {
      this.refresh();
      return;
    }
    this.played = true;
    this.motion.outside(() => {
      this.mm = gsap.matchMedia();
      this.mm.add(
        { motion: '(prefers-reduced-motion: no-preference)', hover: '(hover: hover)' },
        (ctx) => {
          const root = this.host.nativeElement;
          const q = gsap.utils.selector(root);
          if (!(ctx.conditions as any).motion) {
            this.showFinal();
            return;
          }
          this.entrance(q);
        },
        this.host.nativeElement,
      );
    });
  }

  private entrance(q: gsap.utils.SelectorFunc) {
    const tl = gsap.timeline({ onStart: () => this.zone.run(() => this.pending.set(false)) });
    const animateFrom = (selector: string, vars: gsap.TweenVars, position: number) => {
      const targets = q(selector);
      if (targets.length) tl.from(targets, vars, position);
    };

    animateFrom('.welcome > *', {
      y: 20,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
    }, 0);

    animateFrom('.card', {
      y: 34,
      opacity: 0,
      duration: 1.2,
      stagger: 0.18,
      ease: 'power3.out',
    }, 0.28);

    animateFrom(
      '.card__head, .kpi__stat, .kpi__meta, .row-item, .seller, .location-row, .ships-card thead th, .ships-card tbody tr, .bars__grid, .chart-legend, .kpi__label, .kpi__value, .kpi__trend, .kpi__info, .row-item__text > *, .seller__text > *, .seller__nums > *, .location-row > *, .bars__lab, .gauge__val, .gauge__lab, .stat-label, .stat-value',
      {
        y: 16,
        opacity: 0,
        duration: 0.9,
        stagger: 0.05,
        ease: 'power2.out',
      },
      0.75,
    );

    animateFrom(
      '.sales-content > *',
      {
        y: 16,
        opacity: 0,
        duration: 1.5,
        stagger: 0.1,
        ease: 'power2.out',
      },
      0.75,
    );

    animateFrom(
      '.welcome app-icon, .card app-icon',
      {
        scale: 0.55,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'back.out(1.7)',
      },
      0.82,
    );

    animateFrom(
      '.spark__line, .spark__area, .spark__dot',
      {
        opacity: 0,
        scaleX: 0.65,
        transformOrigin: 'left center',
        duration: 1.2,
        stagger: 0.04,
        ease: 'power2.out',
      },
      0.9,
    );

    animateFrom(
      '.bars__bar',
      {
        scaleY: 0,
        transformOrigin: 'bottom',
        duration: 1.1,
        stagger: 0.03,
        ease: 'power3.out',
      },
      0.85,
    );

    animateFrom(
      '.sd-tick',
      {
        opacity: 0,
        duration: 1.1,
        stagger: 0.012,
        ease: 'power1.out',
      },
      0.9,
    );
    this.animateNumbers(q, tl);

    tl.eventCallback('onComplete', () => this.zone.run(() => {
      this.pending.set(false);
      this.entranceDone = true;
    }));
  }

  private showFinal() {
    this.zone.run(() => this.pending.set(false));
    this.snapNumbers();
    this.entranceDone = true;
  }

  private snapNumbers(): void {
    const q = gsap.utils.selector(this.host.nativeElement);
    q('.sd-num').forEach((el) => {
      const target = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind');
      if (!Number.isFinite(target)) return;
      this.motion.setFinal(el as HTMLElement, target, this.numFmt(kind));
    });
  }

  private animateNumbers(q?: gsap.utils.SelectorFunc, tl?: gsap.core.Timeline): void {
    const sel = q ?? gsap.utils.selector(this.host.nativeElement);
    const els = sel('.sd-num') as HTMLElement[];
    if (!els.length) return;
    this.motion.outside(() => {
      els.forEach((el) => {
        const target = Number(el.getAttribute('data-to'));
        const kind = el.getAttribute('data-kind');
        if (!Number.isFinite(target)) return;
        this.motion.countTo(el, target, this.numFmt(kind), {
          tl,
          position: tl ? 0.95 : undefined,
          duration: 1.6,
          from: 0,
        });
      });
    });
  }

  private numFmt(kind: string | null): (n: number) => string {
    return (n: number) => {
      if (kind === 'currency') return this.compact(n);
      if (kind === 'currency-full') return this.money(n);
      if (kind === 'percent') return Math.round(n) + '%';
      return this.count(Math.round(n));
    };
  }

  private refresh() {
    this.animateNumbers();
  }

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly now = Date.now();

  /** Dashboard aggregates from the API, falling back to local store data when the API has no value. */
  protected readonly apiDashboard = computed(() => this.dashboardData());
  protected readonly apiBestSellers = computed(() => this.dashboardBestSellers());

  /** Low stock includes variant SKUs and raw materials from the API. */
  protected readonly lowCount = computed(() => {
    const data = this.lowStockData();
    return data ? data.variants.length + data.materials.length : null;
  });

  /** Open orders — from API metrics.openOrders when available. */
  protected readonly openOrders = computed(() =>
    this.dashboardData()?.metrics.openOrders ?? this.store.openOrders().length,
  );

  /** Pending approvals — items awaiting review from the API dashboard. */
  protected readonly pendingApprovals = computed(() =>
    this.dashboardData()?.pendingApprovals ?? null,
  );

  /** Paid sales count for the current month from the analytics API. */
  protected readonly numberOfSales = computed(() =>
    this.dashboardData()?.salesMonthToDate.orders ?? null,
  );

  /** Paid revenue for the current month from the analytics API. */
  protected readonly totalSales = computed(() =>
    this.dashboardData()?.salesMonthToDate.revenue ?? null,
  );

  /** Sales goal is an optional user setting, not a value supplied by analytics. */
  protected readonly salesGoal = computed(() => {
    const goal = this.store.settings().goal;
    return goal > 0 ? goal : null;
  });

  protected readonly salesPct = computed(() => {
    const goal = this.salesGoal();
    const total = this.totalSales();
    return goal !== null && total !== null ? (total / goal) * 100 : 0;
  });

  protected readonly salesPctLabel = computed(() =>
    this.totalSales() === null || this.salesGoal() === null
      ? '—'
      : `${this.salesPct().toFixed(1)}%`,
  );
  protected readonly remainingGoal = computed(() => {
    const total = this.totalSales();
    const goal = this.salesGoal();
    return total === null || goal === null ? null : Math.max(goal - total, 0);
  });
  protected readonly daysLeftInMonth = computed(() => {
    const now = new Date(this.now);
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  });

  /** Top sellers — from API bestSellers when available. */
  protected readonly sellers = computed(() =>
    this.dashboardBestSellers().map((s) => {
      return {
        id: s.variantId,
        name: s.productName,
        sku: s.sku,
        size: '',
        units: s.unitsSold,
        revenue: s.revenue,
        photo: this.sellerPhoto(s.sku, s.productName),
      };
    }),
  );

  /** Channel bars — from API salesByChannel when available. */
  protected readonly channelBars = computed(() =>
    this.dashboardData()?.salesByChannel.map((c) => ({
      label: c.channel.charAt(0).toUpperCase() + c.channel.slice(1),
      value: c.orders,
      color: c.channel === 'wholesale' ? 'var(--ocean)' : c.channel === 'studio' ? 'var(--ochre)' : 'var(--primary)',
    })) ?? [],
  );

  /** Monthly movement and stock-value series from the inventory API. */
  protected readonly stockTrendBars = computed(() => {
    const movements = this.inventoryMovements() ?? [];
    return movements;
  });

  protected async selectChartPeriod(period: AnalyticsInventoryMovementPeriod): Promise<void> {
    this.chartPeriod.set(period);
    const request = ++this.chartRequest;
    this.chartLoading.set(true);
    this.chartError.set(null);
    try {
      const movements = await this.analyticsApi.inventoryMovementTrend(period);
      if (request === this.chartRequest) this.inventoryMovements.set(movements);
    } catch (error) {
      if (request === this.chartRequest) this.chartError.set(this.errorMessage(error));
    } finally {
      if (request === this.chartRequest) this.chartLoading.set(false);
    }
  }

  protected toggleChartExpanded(): void {
    this.chartExpanded.update((expanded) => !expanded);
  }

  /** Stock trend series values for sparkline charts — from API series when available. */
  /** Flags driven by API data where available, falling back to Store. */
  protected readonly flags = computed<OverviewPresence>(() => {
    return {
      welcome: true,
      sales: true,
      open: true,
      approvals: true,
      chart: (this.inventoryMovements()?.length ?? 0) > 0,
      gauge: true,
      activities: true,
      alerts: this.dashboardAlerts().length > 0,
      sellers: this.dashboardBestSellers().length > 0,
      ships: this.store.shippingQueue().length > 0,
      locations: true,
    };
  });

  protected readonly spans = computed(() => computeOverviewSpans(this.flags()));

  protected readonly dashboardAlerts = computed(() => {
    const data = this.lowStockData();
    if (!data) return [];
    const products = this.store.products();
    return [
      ...data.variants.map((item) => {
        const product = products.find((candidate) =>
          candidate.variantIds?.includes(item.variantId),
        );
        return {
          id: item.variantId,
          title: item.productName || product?.name || item.sku,
          detail: `${item.sku} · ${item.currentQuantity} on hand · reorder at ${item.reorderThreshold}`,
          tone: item.currentQuantity <= 0 ? 'bad' : 'warn',
        };
      }),
      ...data.materials.map((item) => ({
        id: item.id,
        title: item.name,
        detail: `${item.currentQuantity} on hand · reorder at ${item.reorderThreshold}`,
        tone: item.currentQuantity <= 0 ? 'bad' : 'warn',
      })),
    ];
  });

  protected readonly me = computed(() => {
    const stored = this.store.settings().me;
    const user = this.auth.user();
    return {
      ...stored,
      name: stored.name.trim() || user?.name || '',
      email: stored.email || user?.email || '',
    };
  });
  protected readonly company = computed(() => this.store.settings().company);

  protected readonly stamp = computed(() => dateFull(this.now));

  protected readonly toShip = computed(() => this.store.ordersToShip().length);
  protected readonly unpaid = computed(() => this.store.unpaidOrders().length);

  /** Location slices — not exposed by API; kept from Store. */
  protected readonly locationSlices = computed(() => {
    const rows = this.store.stockByLocation();
    const total = rows.reduce((a, b) => a + b.units, 0) || 1;
    return rows.map((l, i) => ({
      label: l.name,
      value: Math.round(l.units),
      pct: Math.round((l.units / total) * 100),
      color: LOCATION_COLORS[i % LOCATION_COLORS.length],
    }));
  });

  /** Shipping queue — not exposed by API; kept from Store. */
  protected readonly queue = computed(() => this.store.shippingQueue());

  protected readonly low = computed(() => this.store.lowStock().slice(0, 6));
  protected readonly feed = computed(() => this.store.activityFeed().slice(0, 5));

  protected readonly inQa = computed(() => this.store.batchStats().inQa);

  protected tone(status: string): string {
    return statusTone(status);
  }

  protected label(status: string): string {
    return statusLabel(status);
  }

  protected due(ts: number): string {
    return until(ts, this.now);
  }

  protected ago(ts: number): string {
    return relative(ts, this.now);
  }

  protected compact(value: number): string {
    return moneyCompact(value);
  }
}

