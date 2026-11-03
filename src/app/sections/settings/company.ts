import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Settings } from '../../core/models';

const CURRENCIES = [
  { id: 'NGN', label: 'Naira (NGN)' },
  { id: 'USD', label: 'US dollar (USD)' },
  { id: 'CAD', label: 'Canadian dollar (CAD)' },
  { id: 'EUR', label: 'Euro (EUR)' },
  { id: 'GBP', label: 'Pound sterling (GBP)' },
];

const ZONES = [
  { id: 'Africa/Lagos', label: 'West Africa (Lagos)' },
  { id: 'America/New_York', label: 'Eastern (New York)' },
  { id: 'America/Chicago', label: 'Central (Chicago)' },
  { id: 'America/Denver', label: 'Mountain (Denver)' },
  { id: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

@Component({
  selector: 'app-settings-company',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">The business behind Vessa</span>
        <h1 class="head__title">Company</h1>
      </div>
    </div>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Business details</h2>
          <p class="card__sub">Used across orders, reports and generated documents.</p>
        </div>
      </div>
      <div class="card__body fields">
        <label class="field">
          <span class="field__label">Trading name</span>
          <input type="text" [value]="draft().name" (input)="patch('name', $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">Legal name</span>
          <input type="text" [value]="draft().legal" (input)="patch('legal', $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">Contact email</span>
          <input type="email" [value]="draft().email" (input)="patch('email', $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">Phone</span>
          <input type="tel" [value]="draft().phone" (input)="patch('phone', $any($event.target).value)" />
        </label>
        <label class="field field--wide">
          <span class="field__label">Registered address</span>
          <input type="text" [value]="draft().address" (input)="patch('address', $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">EIN</span>
          <input type="text" [value]="draft().taxId" (input)="patch('taxId', $any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">Currency</span>
          <select [value]="draft().currency" (change)="patch('currency', $any($event.target).value)">
            @for (c of currencies; track c.id) {
              <option [value]="c.id">{{ c.label }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">Time zone</span>
          <select [value]="draft().timezone" (change)="patch('timezone', $any($event.target).value)">
            @for (z of zones; track z.id) {
              <option [value]="z.id">{{ z.label }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field__label">Financial year starts</span>
          <select [value]="draft().fiscalStart" (change)="patch('fiscalStart', $any($event.target).value)">
            @for (m of months; track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
        </label>
        <p class="field__hint field--wide">Reports use this financial year start for year-to-date totals, the company currency for amounts and the company time zone for dates.</p>
      </div>
      <div class="card__foot">
        @if (dirty()) {
          <span class="badge badge--warn">Unsaved changes</span>
        } @else {
          <span class="hint">Saved to the business profile.</span>
        }
        <div class="card__foot__actions">
          @if (dirty()) {
            <button type="button" class="btn btn--ghost" (click)="discard()">Discard</button>
          }
          <button type="button" class="btn btn--primary" [disabled]="!dirty()" (click)="save()">Save details</button>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Your data</h2>
          <p class="card__sub">Export current records as CSV</p>
        </div>
      </div>
      <div class="card__body">
        <ul class="data">
          <li class="data__row">
            <span class="data__name">Stock</span>
            <span class="data__desc">Every product by location</span>
            <button type="button" class="btn btn--xs btn--ghost" (click)="downloadStock()">Download CSV</button>
          </li>
          <li class="data__row">
            <span class="data__name">Orders</span>
            <span class="data__desc">{{ ordersTotal() }} sales orders</span>
            <button type="button" class="btn btn--xs btn--ghost" (click)="downloadOrders()">Download CSV</button>
          </li>
          <li class="data__row">
            <span class="data__name">Stock ledger</span>
            <span class="data__desc">{{ movesTotal() }} movements</span>
            <button type="button" class="btn btn--xs btn--ghost" (click)="downloadMoves()">Download CSV</button>
          </li>
        </ul>
      </div>
    </article>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Stock preferences</h2>
          <p class="card__sub">Applied across stock alerts and reports.</p>
        </div>
      </div>
      <div class="card__body prefs">
        <div class="pref">
          <span class="field__label">Expiry warning</span>
          <span class="field__hint">
            {{ lotsInside() }} released lots fall within this saved warning window. Alert delivery is not connected.
          </span>
          <div class="pref__row">
            <div class="seg" role="group" aria-label="Expiry warning">
              @for (d of expiryOptions; track d) {
                <button type="button" class="seg__btn" [class.is-on]="prefs().expiryWarnDays === d" [attr.aria-pressed]="prefs().expiryWarnDays === d" (click)="setExpiryWarning(d)">
                  {{ d }} d
                </button>
              }
            </div>
            <span class="saved">Saved</span>
          </div>
        </div>

        <div class="pref">
          <span class="field__label">Low stock is judged by</span>
          <span class="field__hint">Saved as a preference for stock reports and alerts.</span>
          <div class="pref__row">
            <div class="seg" role="group" aria-label="Low stock mode">
              <button type="button" class="seg__btn" [class.is-on]="prefs().lowStockMode === 'reorder'" [attr.aria-pressed]="prefs().lowStockMode === 'reorder'" (click)="setLowStockMode('reorder')">
                Reorder point
              </button>
              <button type="button" class="seg__btn" [class.is-on]="prefs().lowStockMode === 'cover'" [attr.aria-pressed]="prefs().lowStockMode === 'cover'" (click)="setLowStockMode('cover')">
                Days of cover
              </button>
            </div>
            <span class="saved">Saved</span>
          </div>
        </div>

        <div class="pref">
          <span class="field__label">Ship from</span>
          <span class="field__hint">The location new sales orders pick from.</span>
          <div class="pref__row">
            <select [value]="prefs().defaultLoc" (change)="setDefaultLocation($any($event.target).value)">
              @for (l of store.locations(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
            <span class="saved">Saved</span>
          </div>
        </div>

        <div class="pref">
          <span class="field__label">Week starts on</span>
          <span class="field__hint">Applied to weekly Analytics report buckets.</span>
          <div class="pref__row">
            <div class="seg" role="group" aria-label="Week start">
              <button type="button" class="seg__btn" [class.is-on]="prefs().weekStart === 'mon'" [attr.aria-pressed]="prefs().weekStart === 'mon'" (click)="setWeekStart('mon')">
                Monday
              </button>
              <button type="button" class="seg__btn" [class.is-on]="prefs().weekStart === 'sun'" [attr.aria-pressed]="prefs().weekStart === 'sun'" (click)="setWeekStart('sun')">
                Sunday
              </button>
            </div>
            <span class="saved">Saved</span>
          </div>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Locations</h2>
          <p class="card__sub">{{ store.locations().length }} sites holding stock</p>
        </div>
        <a class="btn btn--ghost" routerLink="/warehouses/locations">View locations</a>
      </div>
      <ul class="sites">
        @for (l of store.locations(); track l.id) {
          <li class="site">
            <span class="site__name">{{ l.name }}</span>
            <span class="site__addr">{{ l.address }}</span>
            <span class="site__city">{{ l.city }}</span>
          </li>
        }
      </ul>
    </article>
  `,
  styles: `
    article.card { margin-bottom: var(--gap); }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 13px; }
    .field--wide { grid-column: 1 / -1; }
    .field { display: grid; gap: 5px; }
    .field__label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
    .field__hint { font-size: var(--fs-2xs); color: var(--faint); }
    .card__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .card__foot__actions { display: flex; gap: 8px; }
    .hint { font-size: var(--fs-xs); color: var(--faint); }
    .data { list-style: none; margin: 0 0 14px; padding: 0; }
    .data__row { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
    .data__row:first-child { border-top: none; }
    .data__name { font-weight: 700; }
    .data__desc { font-size: var(--fs-xs); color: var(--muted); }
    .reset { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
    .reset__text { display: grid; gap: 2px; }
    .reset__text span { font-size: var(--fs-xs); color: var(--muted); max-width: 62ch; }
    .prefs { display: grid; gap: 18px; }
    .pref { display: grid; gap: 5px; }
    .pref__row { display: flex; align-items: center; gap: 10px; margin-top: 3px; }
    .saved { font-size: var(--fs-2xs); font-weight: 700; color: var(--primary); }
    .sites { list-style: none; margin: 0; padding: 0; }
    .site { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
    .site:first-child { border-top: none; }
    .site__name { font-weight: 700; }
    .site__addr { font-size: var(--fs-xs); color: var(--muted); }
    .site__city { font-size: var(--fs-xs); color: var(--faint); }
  `,
})
export class SettingsCompany {
  protected readonly store = inject(Store);

  protected readonly currencies = CURRENCIES;
  protected readonly zones = ZONES;
  protected readonly months = MONTHS;
  protected readonly expiryOptions = [30, 60, 90, 120];

  protected readonly company = computed(() => this.store.settings().company);
  protected readonly prefs = computed(() => this.store.settings().prefs);
  protected readonly draft = signal({ ...this.store.settings().company });

  protected readonly ordersTotal = computed(() => this.store.orders().length);
  protected readonly movesTotal = computed(() => this.store.moves().length);

  protected readonly lotsInside = computed(() => {
    const days = this.prefs().expiryWarnDays;
    const now = Date.now();
    return this.store
      .batches()
      .filter((b) => b.status === 'released' && b.expiresAt >= now && b.expiresAt <= now + days * 86400000)
      .length;
  });

  protected readonly dirty = computed(() => {
    const c = this.company();
    const d = this.draft();
    return (
      d.name !== c.name ||
      d.legal !== c.legal ||
      d.address !== c.address ||
      d.phone !== c.phone ||
      d.email !== c.email ||
      d.taxId !== c.taxId ||
      d.currency !== c.currency ||
      d.timezone !== c.timezone ||
      d.fiscalStart !== c.fiscalStart
    );
  });

  protected patch(
    key: 'name' | 'legal' | 'address' | 'phone' | 'email' | 'taxId' | 'currency' | 'timezone' | 'fiscalStart',
    value: string,
  ): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected discard(): void {
    this.draft.set({ ...this.company() });
  }

  protected save(): void {
    this.store.updateCompany(this.draft());
  }

  protected setExpiryWarning(value: number): void {
    this.store.updatePrefs({ expiryWarnDays: value });
  }

  protected setLowStockMode(value: Settings['prefs']['lowStockMode']): void {
    this.store.updatePrefs({ lowStockMode: value });
  }

  protected setDefaultLocation(value: string): void {
    this.store.updatePrefs({ defaultLoc: value });
  }

  protected setWeekStart(value: Settings['prefs']['weekStart']): void {
    this.store.updatePrefs({ weekStart: value });
  }

  protected downloadStock(): void {
    const rows: (string | number)[][] = [['SKU', 'Product', 'Location', 'On hand']];
    for (const product of this.store.products()) {
      for (const location of this.store.locations()) {
        rows.push([
          product.sku,
          `${product.name} ${product.size}`,
          location.name,
          product.stock[location.id] ?? 0,
        ]);
      }
    }
    downloadCsv('vessa-stock.csv', rows);
  }

  protected downloadOrders(): void {
    const rows: (string | number)[][] = [
      ['Order', 'Date', 'Channel', 'Status', 'Customer', 'Product', 'SKU', 'Units', 'Unit price'],
    ];
    for (const order of this.store.orders()) {
      const customer = this.store.customer(order.customerId)?.name ?? order.customerId;
      for (const line of order.lines) {
        const product = this.store.product(line.productId);
        rows.push([
          order.number,
          new Date(order.createdAt).toISOString(),
          order.channel,
          order.status,
          customer,
          product ? `${product.name} ${product.size}` : line.productId,
          product?.sku ?? '',
          line.qty,
          line.price,
        ]);
      }
    }
    downloadCsv('vessa-orders.csv', rows);
  }

  protected downloadMoves(): void {
    const rows: (string | number)[][] = [['Date', 'Item', 'Location', 'Kind', 'Reference', 'Units', 'Value', 'By']];
    for (const move of this.store.moves()) {
      rows.push([
        new Date(move.at).toISOString(),
        this.store.product(move.itemId)?.name ?? this.store.material(move.itemId)?.name ?? move.itemId,
        this.store.location(move.locId)?.name ?? move.locId,
        move.kind,
        move.ref,
        move.qty,
        move.value,
        this.store.teammate(move.byId)?.name ?? move.byId,
      ]);
    }
    downloadCsv('vessa-stock-ledger.csv', rows);
  }

}

function downloadCsv(name: string, rows: (string | number)[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
