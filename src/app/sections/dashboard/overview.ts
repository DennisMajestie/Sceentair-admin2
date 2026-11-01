import { ChangeDetectionStrategy, Component, computed, inject, ElementRef, NgZone, Injector, effect, signal, DestroyRef, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, dateFull, money as fmtMoney, moneyCompact, relative, statusTone, statusLabel, until } from '../../core/format';
import { Sparkline, Donut, Bars, HBar, Gauge } from '../../ui/chart';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import { SdMotionService } from '../../core/sd-motion.service';
import { AuthService } from '../../core/auth.service';
import { gsap } from 'gsap';
import {
  AnalyticsDashboard,
  AnalyticsApiService,
} from '../../core/analytics-api.service';

const LOCATION_COLORS = ['var(--pine)', 'var(--ocean)', 'var(--ochre)', 'var(--sage)'];

export interface OverviewPresence {
  welcome: boolean;
  stock: boolean;
  value: boolean;
  low: boolean;
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
  stock: string;
  value: string;
  low: string;
  chart: string;
  gauge: string;
  activities: string;
  alerts: string;
  sellers: string;
  ships: string;
  locations: string;
}

export function computeOverviewSpans(p: OverviewPresence): OverviewSpans {
  const figureKeys = ['stock', 'value', 'low'] as const;
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
    stock: p.stock ? `span ${figureSpans.get('stock')}` : '',
    value: p.value ? `span ${figureSpans.get('value')}` : '',
    low: p.low ? `span ${figureSpans.get('low')}` : '',
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
  imports: [RouterLink, Sparkline, Bars, Gauge, Icon, ProductShot],
  host: {
    '[class.sd-pending]': 'pending()',
    '[style.--ov-welcome]': 'spans().welcome',
    '[style.--ov-stock]': 'spans().stock',
    '[style.--ov-value]': 'spans().value',
    '[style.--ov-low]': 'spans().low',
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

  protected pending = signal(true);
  protected readonly store = inject(Store);
  protected readonly analyticsApi = inject(AnalyticsApiService);
  protected readonly dashboardData = signal<AnalyticsDashboard | null>(null);
  protected readonly dashboardBestSellers = signal<{ variantId: string; sku: string; productName: string; unitsSold: number; revenue: number }[]>([]);
  protected readonly dashboardError = signal<string | null>(null);
  private mm?: gsap.MatchMedia;
  private played = false;

  private sellerPhoto(sku: string, productName: string): string {
    const products = this.store.products();
    return products.find((product) => product.sku === sku)?.photo
      ?? products.find((product) => product.name === productName)?.photo
      ?? '';
  }

  constructor() {
    effect(() => {
      this.store.data();
      afterNextRender(() => this.onData(), { injector: this.injector });
    });
    this.destroyRef.onDestroy(() => this.mm?.revert());
    void this.loadDashboard();
  }

  private async loadDashboard(): Promise<void> {
    this.pending.set(true);
    this.dashboardError.set(null);
    try {
      const [dashboard, bestSellers] = await Promise.all([
        this.analyticsApi.dashboard(),
        this.analyticsApi.bestSellers(5),
      ]);
      this.dashboardData.set(dashboard);
      this.dashboardBestSellers.set(bestSellers);
    } catch (err) {
      this.dashboardError.set(err instanceof Error ? err.message : 'Could not load dashboard data.');
    } finally {
      this.pending.set(false);
    }
  }

  /** Dashboard aggregates from the API, falling back to local store data when the API has no value. */
  protected readonly apiUnits = computed(() => this.dashboardData()?.inventory.finishedGoodsUnits ?? null);
  protected readonly apiLowCount = computed(() => this.dashboardData()?.inventory.lowStockMaterialCount ?? null);
  protected readonly apiOpenOrders = computed(() => this.dashboardData()?.metrics.openOrders ?? null);
  protected readonly apiTotalSales = computed(() => this.dashboardData()?.metrics.revenue ?? null);
  protected readonly apiNumberOfSales = computed(() => this.dashboardData()?.salesToday.orders ?? null);
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
            this.showFinal(q);
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
    q('.sd-num').forEach((el) => {
      const target = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind');
      const fmt = (n: number) => {
        if (kind === 'currency') return this.compact(n);
        if (kind === 'percent') return Math.round(n) + '%';
        return this.count(Math.round(n));
      };
      this.motion.countTo(el as HTMLElement, target, fmt, { tl, position: 0.85, duration: 1.4 });
    });

    tl.eventCallback('onComplete', () => this.zone.run(() => this.pending.set(false)));
  }

  private showFinal(q: gsap.utils.SelectorFunc) {
    this.zone.run(() => this.pending.set(false));
    q('.sd-num').forEach((el) => {
      const target = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind');
      const fmt = (n: number) => {
        if (kind === 'currency') return this.compact(n);
        if (kind === 'percent') return Math.round(n) + '%';
        return this.count(Math.round(n));
      };
      this.motion.setFinal(el as HTMLElement, target, fmt);
    });
  }

  private refresh() {
    const q = gsap.utils.selector(this.host.nativeElement);
    q('.sd-num').forEach((el) => {
      const target = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind');
      const fmt = (n: number) => {
        if (kind === 'currency') return this.compact(n);
        if (kind === 'percent') return Math.round(n) + '%';
        return this.count(Math.round(n));
      };
      this.motion.countTo(el as HTMLElement, target, fmt, { duration: 0.5 });
    });
  }

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly now = Date.now();

  /** Dashboard aggregates from the API, falling back to local store data when the API has no value. */
  protected readonly apiDashboard = computed(() => this.dashboardData());
  protected readonly apiBestSellers = computed(() => this.dashboardBestSellers());

  /** Units on hand — from API inventory.finishedGoodsUnits when available. */
  protected readonly units = computed(() =>
    this.dashboardData()?.inventory.finishedGoodsUnits ?? this.store.unitsOnHand(),
  );

  /** Total stock value — from API metrics.revenue when available (API reports revenue, not at-cost value). */
  protected readonly stockValue = computed(() =>
    this.dashboardData()?.metrics.revenue ?? this.store.stockValue(),
  );

  /** Low stock items — from API inventory.lowStockMaterialCount when available. */
  protected readonly lowCount = computed(() =>
    this.dashboardData()?.inventory.lowStockMaterialCount ?? this.store.lowStock().length,
  );

  /** Open orders — from API metrics.openOrders when available. */
  protected readonly openOrders = computed(() =>
    this.dashboardData()?.metrics.openOrders ?? this.store.openOrders().length,
  );

  /** Number of sales — from API salesToday.orders when available. */
  protected readonly numberOfSales = computed(() =>
    this.dashboardData()?.salesToday.orders ??
      this.store.orders().filter((o) => o.status !== 'cancelled').length,
  );

  /** Total sales — from API metrics.revenue when available. */
  protected readonly totalSales = computed(() =>
    this.dashboardData()?.metrics.revenue ??
      this.store.orders().reduce(
        (total, o) =>
          o.status === 'cancelled'
            ? total
            : total + o.lines.reduce((a, l) => a + l.qty * l.price, 0),
        0,
      ),
  );

  /** Sales goal — kept from settings (not provided by API). */
  protected readonly salesGoal = computed(() => this.store.settings().goal || 24500);

  protected readonly salesPct = computed(() => {
    const goal = this.salesGoal();
    return goal > 0 ? (this.totalSales() / goal) * 100 : 0;
  });

  protected readonly salesPctLabel = computed(() => `${this.salesPct().toFixed(1)}%`);
  protected readonly remainingGoal = computed(() => Math.max(this.salesGoal() - this.totalSales(), 0));
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

  /** Stock trend bars — from API series when available. */
  /** Stock trend bars — from API series when available. */
  protected readonly stockTrendBars = computed(() =>
    this.dashboardData()?.series.map((s) => ({
      label: s.label,
      value: s.revenue,
      in: 0,
      out: 0,
    })) ?? [],
  );

  /** Stock trend series values for sparkline charts — from API series when available. */
  protected readonly stockTrendSeries = computed(() =>
    this.dashboardData()?.series.map((s) => s.revenue) ?? [],
  );

  /** Stock in value — not exposed by API; kept from Store moves. */
  protected readonly stockInValue = computed(() => {
    const cutoff = this.now - 30 * 86400000;
    let total = 0;
    for (const m of this.store.moves()) {
      if (m.kind !== 'receipt' || m.at < cutoff) continue;
      const p = this.store.productById()[m.itemId];
      total += Math.abs(m.qty) * (p?.cost ?? 0);
    }
    return total;
  });

  /** Stock out value — not exposed by API; kept from Store moves. */
  protected readonly stockOutValue = computed(() => {
    const cutoff = this.now - 30 * 86400000;
    let total = 0;
    for (const m of this.store.moves()) {
      if (m.kind !== 'sale' || m.at < cutoff) continue;
      const p = this.store.productById()[m.itemId];
      total += Math.abs(m.qty) * (p?.cost ?? 0);
    }
    return total;
  });

  protected readonly stockValueDelta = computed(() => {
    const vals = this.dashboardData()?.series.map((s) => s.revenue) ?? this.store.months().map((m) => m.value);
    if (vals.length < 2) return 0;
    const first = vals[0] || 1;
    const last = vals[vals.length - 1];
    return Math.round(((last - first) / first) * 100);
  });

  protected readonly unitsDelta = computed(() => {
    const vals = this.dashboardData()?.series.map((s) => s.revenue) ?? this.store.months().map((m) => m.value);
    if (vals.length < 2) return 0;
    const first = vals[0] || 1;
    const last = vals[vals.length - 1];
    return Math.round(((last - first) / first) * 100);
  });

  /** Flags driven by API data where available, falling back to Store. */
  protected readonly flags = computed<OverviewPresence>(() => {
    const d = this.dashboardData();
    return {
      welcome: true,
      stock: true,
      value: true,
      low: true,
      chart: (d?.series?.length ?? this.store.months().length) > 0,
      gauge: true,
      activities: true,
      alerts: this.store.alerts().length > 0,
      sellers: this.dashboardBestSellers().length > 0,
      ships: this.store.shippingQueue().length > 0,
      locations: true,
    };
  });

  protected readonly spans = computed(() => computeOverviewSpans(this.flags()));

  protected readonly hasTrend = computed(() => (this.dashboardData()?.series?.length ?? this.store.months().length) >= 2);

  protected readonly lowThumbs = computed(() =>
    this.store
      .lowStockProducts()
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        name: r.name,
        photo: this.store.productById()[r.id]?.photo ?? '',
      }))
      .filter((t) => t.photo),
  );

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

  protected readonly outCount = computed(() => this.store.outOfStock().length);
  protected readonly lowProducts = computed(() => this.store.lowStockProducts().length);
  protected readonly lowMaterials = computed(() => this.store.lowStockMaterials().length);
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
  protected readonly feed = computed(() => this.store.activityFeed().slice(0, 7));

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
