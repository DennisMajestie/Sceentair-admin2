import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, date as fmtDate, statusLabel, statusTone } from '../../core/format';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';

@Component({
  selector: 'app-warehouses-transfers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductShot],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Stock moving between the lab, the DC and the shop</span>
        <h1 class="head__title">Transfers</h1>
        <p class="head__lead">{{ rows().length }} transfers on the books, {{ onRoad().length }} on the road.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--primary" routerLink="/warehouses/locations">
          <app-icon name="warehouses" [size]="15" />
          View locations
        </a>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">On the road</span>
        <span class="kpi__value">{{ count(onRoadUnits()) }}<span class="kpi__suffix">units</span></span>
        <span class="kpi__meta">{{ onRoad().length }} transfers moving</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Planned</span>
        <span class="kpi__value">{{ count(planned().length) }}<span class="kpi__suffix">transfers</span></span>
        <span class="kpi__meta">waiting to dispatch</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Received, 30 days</span>
        <span class="kpi__value">{{ count(receivedUnits()) }}<span class="kpi__suffix">units</span></span>
        <span class="kpi__meta">landed and on the shelves</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Average transfer duration</span>
        <span class="kpi__value">{{ avgHours() }}<span class="kpi__suffix">h</span></span>
        <span class="kpi__meta">created to planned ETA</span>
      </article>
    </section>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
          All {{ rows().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'planned'" [attr.aria-pressed]="filter() === 'planned'" (click)="filter.set('planned')">
          Planned {{ planned().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'in-transit'" [attr.aria-pressed]="filter() === 'in-transit'" (click)="filter.set('in-transit')">
          In transit {{ onRoad().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'received'" [attr.aria-pressed]="filter() === 'received'" (click)="filter.set('received')">
          Received {{ received().length }}
        </button>
      </div>
      <div class="toolbar__spacer"></div>
      <span class="badge">{{ visible().length }} transfers</span>
    </div>

    <section class="cards">
      @for (t of moving(); track t.id) {
        <article class="card tcard">
          <div class="tcard__head">
            <span class="mono tcard__num">{{ t.number }}</span>
            <span class="badge" [class]="'badge badge--' + t.tone">{{ t.label }}</span>
          </div>

          <p class="tcard__when">{{ t.when }}</p>

          <div class="tcard__route">
            <span class="tcard__node">
              <strong>{{ t.from }}</strong>
              <span>{{ t.fromCity }}</span>
            </span>
            <span class="tcard__arrow" aria-hidden="true">
              <app-icon name="chevron" [size]="18" />
            </span>
            <span class="tcard__node tcard__node--end">
              <strong>{{ t.to }}</strong>
              <span>{{ t.toCity }}</span>
            </span>
          </div>

          <ul class="tcard__lines">
            @for (line of t.lines; track line.productId) {
              <li class="tline">
                <span class="thumb thumb--sm"><app-product-shot [photo]="line.photo" [label]="line.name" /></span>
                <span class="tline__text">
                  <strong>{{ line.name }} {{ line.size }}</strong>
                  <span class="mono">{{ line.sku }}</span>
                </span>
                <span class="num">× {{ line.qty }}</span>
              </li>
            }
          </ul>

          <div class="tcard__foot">
            <span class="tcard__meta">{{ t.etaLabel }} · {{ count(t.units) }} units · {{ t.lines.length }} lines</span>
          </div>
        </article>
      }
    </section>

    @if (receivedVisible().length > 0) {
      <section class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Received</h2>
            <p class="card__sub">Landed and on the shelves</p>
          </div>
        </div>
        <ul class="rows">
          @for (t of receivedVisible(); track t.id) {
            <li class="tile row--tint recv">
              <span class="recv__id">{{ t.number }}</span>
              <span class="recv__route">{{ t.from }} → {{ t.to }}</span>
              <span class="recv__meta">{{ count(t.units) }} units · received {{ t.receivedLabel }}</span>
              <span class="recv__by">{{ t.by }}</span>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__suffix { font-size: var(--fs-xl); color: var(--muted); margin-left: 3px; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .tcard { display: grid; gap: 13px; align-content: start; }
    .tcard__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tcard__num { font-size: var(--fs-lg); font-weight: 700; }
    .tcard__when { margin: 0; font-size: var(--fs-sm); color: var(--muted); }
    .tcard__route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
    .tcard__node { display: grid; line-height: 1.25; }
    .tcard__node strong { font-size: var(--fs-md); }
    .tcard__node span { font-size: var(--fs-2xs); color: var(--faint); }
    .tcard__node--end { text-align: right; }
    .tcard__arrow { color: var(--primary); display: grid; place-items: center; }
    .tcard__lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .tline { display: flex; align-items: center; gap: 10px; }
    .tline__text { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
    .tline__text strong { font-size: var(--fs-md); }
    .tline__text span { font-size: var(--fs-2xs); color: var(--faint); }
    .tcard__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
    .tcard__meta { font-size: var(--fs-2xs); color: var(--faint); }
    .recv { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 14px; font-size: var(--fs-sm); }
    .recv__id { font-weight: 700; }
    .recv__route { color: var(--text); }
    .recv__meta { font-size: var(--fs-2xs); color: var(--faint); }
    .recv__by { font-size: var(--fs-xs); color: var(--muted); }
  `,
})
export class WarehouseTransfers {
  protected readonly store = inject(Store);
  protected readonly count = fmtCount;
  protected readonly date = fmtDate;
  protected readonly filter = signal('all');

  protected readonly rows = computed(() =>
    this.store.transfers().map((t) => {
      const from = this.store.location(t.from);
      const to = this.store.location(t.to);
      const units = t.lines.reduce((a, l) => a + l.qty, 0);
      const by = this.store.teammate(t.byId)?.name ?? t.byId;
      return {
        id: t.id,
        number: t.number,
        from: from?.name ?? t.from,
        fromCity: from?.city ?? '',
        to: to?.name ?? t.to,
        toCity: to?.city ?? '',
        status: t.status,
        tone: statusTone(t.status),
        label: statusLabel(t.status),
        createdAt: t.createdAt,
        eta: t.eta,
        units,
        by,
        when:
          t.status === 'planned'
            ? `Planned ${this.when(t.createdAt)} by ${by}`
            : `In transit · created ${this.when(t.createdAt)} by ${by}`,
        etaLabel:
          t.status === 'planned'
            ? `Leaves when dispatched · ETA ${this.when(t.eta)}`
            : `Arrives ${this.when(t.eta)}`,
        receivedLabel: this.when(t.eta),
        lines: t.lines.map((l) => {
          const p = this.store.product(l.productId);
          return {
            productId: l.productId,
            name: p?.name ?? l.productId,
            size: p?.size ?? '',
            sku: p?.sku ?? '',
            photo: p?.photo ?? 'serum',
            qty: l.qty,
          };
        }),
      };
    }),
  );

  protected readonly onRoad = computed(() => this.rows().filter((r) => r.status === 'in-transit'));

  protected readonly planned = computed(() => this.rows().filter((r) => r.status === 'planned'));

  protected readonly received = computed(() =>
    this.rows()
      .filter((r) => r.status === 'received')
      .sort((a, b) => b.eta - a.eta),
  );

  protected readonly moving = computed(() => {
    const f = this.filter();
    return this.rows().filter((r) => r.status !== 'received' && (f === 'all' || r.status === f));
  });

  protected readonly receivedVisible = computed(() => {
    const f = this.filter();
    return f === 'all' || f === 'received' ? this.received() : [];
  });

  protected readonly visible = computed(() => [...this.moving(), ...this.receivedVisible()]);

  protected readonly onRoadUnits = computed(() =>
    this.onRoad().reduce((a, t) => a + t.units, 0),
  );

  protected readonly receivedUnits = computed(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return this.received()
      .filter((t) => t.eta >= cutoff)
      .reduce((a, t) => a + t.units, 0);
  });

  protected readonly avgHours = computed(() => {
    const done = this.received();
    if (done.length === 0) return 0;
    const hours =
      done.reduce((a, t) => a + Math.max(0, t.eta - t.createdAt) / 3600000, 0) / done.length;
    return Math.round(hours);
  });

  private when(at: number): string {
    const d = new Date(at);
    const day = d.toLocaleString('en-US', { weekday: 'short' });
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return sameDay ? `today ${time}` : `${day} ${time}`;
  }
}
