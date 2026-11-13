import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { date as fmtDate, money as fmtMoney } from '../../core/format';
import { moneyNgn } from '../customers/cs-data';
import { DeliveriesApiService, type DeliveryLeg, type DeliveryLegStatus, type DeliveryLegFilters } from '../../core/deliveries-api.service';
import { LogisticsApiService, type ApiLogisticsPricing, type ApiShippingSettings, type ApiShippingSettingsUpdate } from '../../core/logistics-api.service';
import { ToastService } from '../../core/toast';
import { Spinner } from '../../ui/spinner';

const NIGERIA_GEOPOLITICAL_ZONES = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West',
] as const;

@Component({
  selector: 'app-deliveries-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule, Spinner],
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

    <article class="card ship-panel" aria-label="Shipping settings">
      <button type="button" class="ship-panel__toggle" (click)="togglePanel()" [attr.aria-expanded]="panelOpen()">
        <span class="ship-panel__text">
          <span class="ship-panel__title">Shipping settings</span>
          <span class="ship-panel__sub">Zone pricing and checkout shipping configuration</span>
        </span>
        <span class="badge">{{ panelOpen() ? 'Hide' : 'Show' }}</span>
      </button>
      @if (panelOpen()) {
        @if (panelLoading()) {
          <div class="ship-loading">
            <app-spinner size="md" label="Loading shipping settings" />
          </div>
        } @else {
          @if (settings(); as s) {
            <dl class="facts ship-facts">
              <div><dt>Quote expiry</dt><dd>{{ s.quoteExpiryMinutes }} min</dd></div>
              <div><dt>Prices include VAT</dt><dd>{{ s.pricesIncludeVat ? 'Yes' : 'No' }}</dd></div>
              <div><dt>Delivery taxable</dt><dd>{{ s.deliveryTaxable ? 'Yes' : 'No' }}</dd></div>
            </dl>

            <div class="ship-grid">
              <label class="field field--check"><span class="field__label">Shipping enabled</span><input type="checkbox" [(ngModel)]="settingsForm.shippingEnabled" name="shipPanelShipping" /></label>
              <label class="field"><span class="field__label">Free delivery threshold</span><input type="number" min="0" [(ngModel)]="settingsForm.freeDeliveryThreshold" name="shipPanelThreshold" /></label>
              <label class="field field--check"><span class="field__label">VAT enabled</span><input type="checkbox" [(ngModel)]="settingsForm.vatEnabled" name="shipPanelVat" /></label>
              <label class="field"><span class="field__label">VAT rate %</span><input type="number" min="0" max="100" [(ngModel)]="settingsForm.vatRatePercent" name="shipPanelVatRate" /></label>
              <label class="field field--check"><span class="field__label">Coupons enabled</span><input type="checkbox" [(ngModel)]="settingsForm.couponsEnabled" name="shipPanelCoupons" /></label>
            </div>
            <div class="ship-save">
              <label class="field"><span class="field__label">Reason for change</span><input type="text" placeholder="Required for the audit trail" [(ngModel)]="reason" name="shipPanelReason" /></label>
              <button type="button" class="btn" [disabled]="saving() || !reason.trim()" (click)="saveSettings()">
                @if (saving()) {
                  <app-spinner size="sm" />
                  Saving
                } @else {
                  Save settings
                }
              </button>
            </div>

            <div class="ship-panel__labelrow">
              <h3 class="ship-panel__label">Zone pricing</h3>
              <span class="badge">{{ pricingRows().length }} rows</span>
            </div>
            <div class="table-wrap">
              <table aria-label="Shipping zone pricing">
                <thead>
                  <tr><th scope="col">Zone</th><th scope="col">Base price</th><th scope="col">Per kg price</th></tr>
                </thead>
                <tbody>
                  @for (row of pricingRows(); track row.id) {
                    <tr>
                      <td>{{ row.zone }}</td>
                      <td>{{ ngMoney(row.baseFee) }}</td>
                      <td>{{ ngMoney(row.pricePerKg) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="ship-empty">No price rows yet.</td></tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" class="ship-addcell">
                      <form class="ship-add" (ngSubmit)="addPricingRow()">
                        <label class="field">
                          <span class="field__label">Zone</span>
                          <select [(ngModel)]="addRowForm.zone" name="shipAddZone" required>
                            @for (zone of zones; track zone) {
                              <option [value]="zone">{{ zone }}</option>
                            }
                          </select>
                        </label>
                        <label class="field"><span class="field__label">Base price</span><input type="number" min="0" [(ngModel)]="addRowForm.baseFee" name="shipAddBasePrice" /></label>
                        <label class="field"><span class="field__label">Per kg price</span><input type="number" min="0" [(ngModel)]="addRowForm.pricePerKg" name="shipAddPerKg" /></label>
                        <div class="ship-add__actions">
                          <button type="submit" class="btn" [disabled]="addingPriceRow() || addingAllZones() || !addRowForm.zone.trim()">
                            @if (addingPriceRow()) {
                              <app-spinner size="sm" />
                              Saving
                            } @else {
                              Add price row
                            }
                          </button>
                          <button type="button" class="btn btn--ghost" [disabled]="addingPriceRow() || addingAllZones() || missingZones().length === 0" (click)="addAllZones()">
                            @if (addingAllZones()) {
                              <app-spinner size="sm" />
                              Adding {{ missingZones().length }} zones
                            } @else {
                              Add all missing zones
                            }
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          } @else {
            <p class="ship-panel__note">Shipping settings unavailable.</p>
          }
        }
      }
    </article>

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
    .ship-panel { margin-bottom: 16px; }
    .ship-panel__toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; border: 0; background: transparent; padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .ship-panel__toggle:hover .ship-panel__title, .ship-panel__toggle:focus-visible .ship-panel__title { color: var(--primary); }
    .ship-panel__toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; }
    .ship-panel__text { display: grid; gap: 2px; min-width: 0; }
    .ship-panel__title { font-size: var(--fs-lg); font-weight: 700; letter-spacing: -0.01em; }
    .ship-panel__sub { font-size: var(--fs-xs); color: var(--muted); }
    .ship-panel__note { margin: 14px 0 0; color: var(--muted); font-size: var(--fs-sm); }
    .ship-loading { display: flex; justify-content: center; padding: 28px 16px; color: var(--primary); }
    .ship-facts { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; }
    .ship-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .ship-save { display: flex; align-items: flex-end; gap: 10px; margin-top: 12px; }
    .ship-save .field { flex: 1; min-width: 0; }
    .ship-panel__labelrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 18px 0 10px; }
    .ship-panel__label { margin: 0; font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .ship-empty { color: var(--muted); text-align: center; }
    .ship-addcell { border-top: 1px solid var(--line); background: var(--well); }
    .ship-add { display: grid; grid-template-columns: 1.4fr 0.9fr 0.9fr auto; gap: 10px; align-items: end; padding: 12px 14px; }
    .ship-add__actions { display: flex; align-items: center; gap: 8px; }
    .ship-add__actions .btn { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
    .field--check { justify-items: start; }
    @media (max-width: 700px) {
      .ship-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ship-grid { grid-template-columns: 1fr; }
      .ship-add { grid-template-columns: 1fr 1fr; }
      .ship-add__actions { grid-column: 1 / -1; flex-wrap: wrap; }
      .ship-save { flex-wrap: wrap; align-items: stretch; }
    }
  `,
})
export class DeliveriesList {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly deliveriesApi = inject(DeliveriesApiService);
  private readonly logistics = inject(LogisticsApiService);
  private readonly toasts = inject(ToastService);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly ngMoney = moneyNgn;

  protected readonly query = signal('');
  protected readonly status = signal<DeliveryLegStatus | 'all'>('all');
  protected readonly deliveries = signal<DeliveryLeg[]>([]);

  protected readonly panelOpen = signal(false);
  protected readonly panelLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly addingPriceRow = signal(false);
  protected readonly addingAllZones = signal(false);
  protected readonly settings = signal<ApiShippingSettings | null>(null);
  protected readonly pricingRows = signal<ApiLogisticsPricing[]>([]);
  protected readonly zones = NIGERIA_GEOPOLITICAL_ZONES;
  protected readonly missingZones = computed(() => {
    const existing = new Set(this.pricingRows().map((row) => row.zone.trim().toLowerCase()));
    return this.zones.filter((zone) => !existing.has(zone.toLowerCase()));
  });
  protected settingsForm = { shippingEnabled: false, freeDeliveryThreshold: 0, vatEnabled: false, vatRatePercent: 0, couponsEnabled: false };
  protected reason = '';
  protected addRowForm: { zone: string; baseFee: number; pricePerKg: number } = { zone: NIGERIA_GEOPOLITICAL_ZONES[0], baseFee: 0, pricePerKg: 0 };
  private pricingLoaded = false;

  protected async togglePanel(): Promise<void> {
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    if (next && !this.pricingLoaded) {
      this.panelLoading.set(true);
      try {
        const [rows, settings] = await Promise.all([this.logistics.pricing(), this.logistics.shippingSettings()]);
        this.pricingRows.set(rows);
        this.settings.set(settings);
        this.applySettingsForm(settings);
        this.pricingLoaded = true;
      } catch (err) {
        this.panelOpen.set(false);
        this.toasts.show(err instanceof Error ? err.message : 'Could not load shipping settings.', 'bad');
      } finally {
        this.panelLoading.set(false);
      }
    }
  }

  protected async saveSettings(): Promise<void> {
    const current = this.settings();
    const reason = this.reason.trim();
    if (!current || !reason) return;
    const shippingEnabled = this.settingsForm.shippingEnabled;
    const vatEnabled = this.settingsForm.vatEnabled;
    const couponsEnabled = this.settingsForm.couponsEnabled;
    const freeDeliveryThreshold = this.toNum(this.settingsForm.freeDeliveryThreshold);
    const vatRatePercent = this.toNum(this.settingsForm.vatRatePercent);
    const changed: ApiShippingSettingsUpdate = { reason };
    if (shippingEnabled !== current.shippingEnabled) changed.shippingEnabled = shippingEnabled;
    if (freeDeliveryThreshold !== current.freeDeliveryThreshold) changed.freeDeliveryThreshold = freeDeliveryThreshold;
    if (vatEnabled !== current.vatEnabled) changed.vatEnabled = vatEnabled;
    if (vatRatePercent !== current.vatRatePercent) changed.vatRatePercent = vatRatePercent;
    if (couponsEnabled !== current.couponsEnabled) changed.couponsEnabled = couponsEnabled;
    if (Object.keys(changed).length === 1) {
      this.toasts.show('No changes to save', 'info');
      return;
    }
    this.saving.set(true);
    try {
      await this.logistics.updateShippingSettings(changed);
      this.reason = '';
      this.toasts.show('Shipping settings saved', 'good');
      await this.refetchSettings();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not save shipping settings.', 'bad');
    } finally {
      this.saving.set(false);
    }
  }

  protected async refetchSettings(): Promise<void> {
    try {
      const settings = await this.logistics.shippingSettings();
      this.settings.set(settings);
      this.applySettingsForm(settings);
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not reload shipping settings.', 'bad');
    }
  }

  protected async addPricingRow(): Promise<void> {
    const zone = this.addRowForm.zone.trim();
    if (!zone) return;
    this.addingPriceRow.set(true);
    try {
      await this.logistics.upsertPricing({
        zone,
        baseFee: this.toNum(this.addRowForm.baseFee),
        pricePerKg: this.toNum(this.addRowForm.pricePerKg),
      });
      this.addRowForm = { zone: NIGERIA_GEOPOLITICAL_ZONES[0], baseFee: 0, pricePerKg: 0 };
      this.toasts.show('Price row saved', 'good');
      this.pricingRows.set(await this.logistics.pricing());
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not save the price row.', 'bad');
    } finally {
      this.addingPriceRow.set(false);
    }
  }

  protected async addAllZones(): Promise<void> {
    const missing = this.missingZones();
    if (!missing.length || this.addingAllZones() || this.addingPriceRow()) return;
    this.addingAllZones.set(true);
    const pricing = {
      baseFee: this.toNum(this.addRowForm.baseFee),
      pricePerKg: this.toNum(this.addRowForm.pricePerKg),
    };
    try {
      for (const zone of missing) {
        await this.logistics.upsertPricing({ zone, ...pricing });
      }
      this.toasts.show(`${missing.length} zone price ${missing.length === 1 ? 'row' : 'rows'} saved`, 'good');
      this.pricingRows.set(await this.logistics.pricing());
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not save the zone price rows.', 'bad');
      try {
        this.pricingRows.set(await this.logistics.pricing());
      } catch {
        // Keep the previous rows when the refresh also fails.
      }
    } finally {
      this.addingAllZones.set(false);
    }
  }

  private applySettingsForm(settings: ApiShippingSettings): void {
    this.settingsForm.shippingEnabled = settings.shippingEnabled;
    this.settingsForm.vatEnabled = settings.vatEnabled;
    this.settingsForm.couponsEnabled = settings.couponsEnabled;
    this.settingsForm.freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 0;
    this.settingsForm.vatRatePercent = settings.vatRatePercent ?? 0;
  }

  private toNum(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

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