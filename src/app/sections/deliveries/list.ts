import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { date as fmtDate, money as fmtMoney } from '../../core/format';
import { DeliveriesApiService, type DeliveryLeg, type DeliveryLegStatus, type DeliveryLegFilters } from '../../core/deliveries-api.service';

@Component({
  selector: 'app-deliveries-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Logistics</span>
        <h1 class="head__title">Deliveries</h1>
        <p class="head__lead">{{ deliveries().length }} delivery legs.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Delivery summary">
      <article class="stat">
        <span class="stat__label">Total legs</span>
        <strong class="stat__value">{{ deliveries().length }}</strong>
        <span class="stat__detail">Delivery legs tracked</span>
      </article>
      <article class="stat">
        <span class="stat__label">Pending</span>
        <strong class="stat__value">{{ pendingCount() }}</strong>
        <span class="stat__detail">Not yet started</span>
      </article>
      <article class="stat">
        <span class="stat__label">In transit</span>
        <strong class="stat__value">{{ inTransitCount() }}</strong>
        <span class="stat__detail">Currently moving</span>
      </article>
      <article class="stat">
        <span class="stat__label">Delivered</span>
        <strong class="stat__value">{{ deliveredCount() }}</strong>
        <span class="stat__detail">Completed legs</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        @for (f of statuses; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="status() === f.id" [attr.aria-pressed]="status() === f.id" (click)="status.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search carrier or tracking ref" aria-label="Search deliveries" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} legs</span>
    </div>

    <div class="delivery-grid" aria-label="Delivery legs">
      @for (row of visible(); track row.id) {
        <button type="button" class="delivery-card" (click)="open(row.id)" [attr.aria-label]="'Delivery leg ' + row.id">
          <span class="delivery-card__top">
            <span class="mono delivery-card__id">{{ row.id }}</span>
            <span class="badge" [class]="'badge badge--' + tone(row.status)">{{ row.status }}</span>
          </span>
          <span class="delivery-card__carrier">{{ row.carrier }}</span>
          <span class="delivery-card__leg">Leg {{ row.legNumber }}</span>
          <span class="delivery-card__tracking">{{ row.trackingRef ?? '—' }}</span>
          <span class="delivery-card__meta">
            <span>{{ row.weightKg ?? '—' }} kg</span>
            <span>{{ row.zone ?? '—' }}</span>
          </span>
          <span class="delivery-card__cost">{{ money(row.cost ?? 0) }}</span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="delivery-empty">
          <strong>No delivery legs match.</strong>
          <span>Try another status or search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Delivery leg detail">
      <ng-container drawerTitle>
        @if (selected(); as d) {
          <div class="dtitle">
            <strong class="mono">{{ d.id }}</strong>
            <span class="badge" [class]="'badge badge--' + d.status">{{ d.status }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as d) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Carrier</span>
              <span class="dmeta">{{ d.carrier }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Leg</span>
              <strong class="dtotal">{{ d.legNumber }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Order</dt><dd>{{ d.orderId }}</dd></div>
            <div><dt>Status</dt><dd>{{ d.status }}</dd></div>
            <div><dt>Tracking ref</dt><dd>{{ d.trackingRef ?? '—' }}</dd></div>
            <div><dt>Weight</dt><dd>{{ d.weightKg ?? '—' }} kg</dd></div>
            <div><dt>Zone</dt><dd>{{ d.zone ?? '—' }}</dd></div>
            <div><dt>Cost</dt><dd>{{ money(d.cost ?? 0) }}</dd></div>
            <div><dt>Driver</dt><dd>{{ d.driverName ?? '—' }}</dd></div>
            <div><dt>Driver phone</dt><dd>{{ d.driverPhone ?? '—' }}</dd></div>
            <div><dt>Created</dt><dd>{{ date(d.createdAtNum) }}</dd></div>
            <div><dt>Updated</dt><dd>{{ date(d.updatedAtNum) }}</dd></div>
          </dl>

          <h3 class="dlabel">Update status</h3>
          <div class="dstatus-actions">
            <button type="button" class="btn" (click)="updateStatus(d.id, 'in_transit')">In transit</button>
            <button type="button" class="btn" (click)="updateStatus(d.id, 'delivered')">Delivered</button>
            <button type="button" class="btn btn--ghost" (click)="updateStatus(d.id, 'failed')">Failed</button>
          </div>

          <h3 class="dlabel">Checkpoints</h3>
          <div class="dcheckpoints">{{ jsonStringify(d.checkpoints) }}</div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .delivery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .delivery-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .delivery-card:hover { border-color: var(--primary); }
    .delivery-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .delivery-card__top, .delivery-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .delivery-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .delivery-card__carrier { font-size: var(--fs-md); font-weight: 700; }
    .delivery-card__leg { color: var(--muted); font-size: var(--fs-sm); }
    .delivery-card__tracking { color: var(--text); font-size: var(--fs-sm); font-family: var(--fs-mono, monospace); }
    .delivery-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .delivery-card__cost { color: var(--text); font-size: var(--fs-md); font-weight: 700; white-space: nowrap; }
    .delivery-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .delivery-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dstatus-actions { display: flex; gap: 8px; margin-top: 8px; }
    .dcheckpoints { font-family: var(--fs-mono, monospace); font-size: var(--fs-2xs); white-space: pre-wrap; background: var(--well); border: 1px solid var(--line); border-radius: var(--r-card); padding: 10px; color: var(--muted); margin-top: 8px; }
    @media (max-width: 1100px) { .delivery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .delivery-grid { grid-template-columns: 1fr; } }
  `,
})
export class DeliveriesList {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly deliveriesApi = inject(DeliveriesApiService);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;

  protected readonly query = signal('');
  protected readonly status = signal<DeliveryLegStatus | 'all'>('all');
  protected readonly deliveries = signal<DeliveryLeg[]>([]);

  protected readonly statuses: { id: DeliveryLegStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'in_transit', label: 'In transit' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'failed', label: 'Failed' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  public async load(): Promise<void> {
    const result = await this.deliveriesApi.list({ page: 1, limit: 100 });
    this.deliveries.set(result.map(d => ({ ...d, createdAtNum: Date.parse(d.createdAt), updatedAtNum: Date.parse(d.updatedAt) })));
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.deliveries()
      .filter((d) => {
        if (this.status() !== 'all' && d.status !== this.status()) return false;
        if (!q) return true;
        const haystack = `${d.carrier} ${d.trackingRef ?? ''} ${d.driverName ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.createdAtNum - a.createdAtNum);
  });

  protected readonly pendingCount = computed(() =>
    this.deliveries().filter((d) => d.status === 'pending').length,
  );
  protected readonly inTransitCount = computed(() =>
    this.deliveries().filter((d) => d.status === 'in_transit').length,
  );
  protected readonly deliveredCount = computed(() =>
    this.deliveries().filter((d) => d.status === 'delivered').length,
  );

  protected readonly tone = (status: DeliveryLegStatus): string => {
    switch (status) {
      case 'pending': return 'warn';
      case 'in_transit': return 'ocean';
      case 'delivered': return 'sage';
      case 'failed': return 'bad';
      default: return 'muted';
    }
  };

  protected readonly selected = computed(() => this.deliveries().find((d) => d.id === this.routeId()));

  protected async updateStatus(id: string, status: DeliveryLegStatus): Promise<void> {
    try {
      await this.deliveriesApi.updateStatus(id, { status });
      await this.load();
    } catch (err) {
      await this.load();
    }
  }

  protected open(id: string): void {
    this.router.navigate(['/deliveries', id]);
  }

  protected jsonStringify(value: unknown): string {
    return value == null ? '—' : JSON.stringify(value, null, 2);
  }

  protected close(): void {
    this.router.navigate(['/deliveries']);
  }
}