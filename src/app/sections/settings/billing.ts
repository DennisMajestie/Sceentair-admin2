import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, money as fmtMoney, statusLabel, statusTone } from '../../core/format';
import { Settings } from '../../core/models';

interface Plan {
  id: string;
  name: string;
  blurb: string;
  price: number;
  yearly: number;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'studio',
    name: 'Studio',
    blurb: 'One maker, one shelf',
    price: 39,
    yearly: 470,
    features: ['Up to 5 seats', '1 stock location', 'Batches with expiry dates', 'Online and studio orders'],
  },
  {
    id: 'growth',
    name: 'Growth',
    blurb: 'A lab that sells wholesale',
    price: 119,
    yearly: 1430,
    features: [
      'Up to 15 seats',
      '3 stock locations',
      'QA release and lot holds',
      'Wholesale orders and stockists',
      'Purchase orders and suppliers',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    blurb: 'Several sites and a team',
    price: 279,
    yearly: 3350,
    features: [
      'Up to 50 seats',
      'Unlimited locations',
      'Everything in Growth',
      'API and webhooks',
      'SSO and audit export',
    ],
  },
];

type InvoiceFilter = 'all' | 'paid' | 'due';

@Component({
  selector: 'app-settings-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Your plan, seats and invoices</span>
        <h1 class="head__title">Billing</h1>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">{{ cycle() === 'monthly' ? 'Monthly price' : 'Annual price' }}</span>
        <span class="kpi__value">{{ money(selectedPrice()) }}</span>
        <span class="kpi__meta">{{ currentPlan().name }} plan preview</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Seats in use</span>
        <span class="kpi__value">{{ count(store.team().length) }} of {{ count(billing().seats) }}</span>
        <span class="kpi__meta">{{ count(store.team().length) }} people hold a seat</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Paid this year</span>
        <span class="kpi__value">{{ money(paidThisYear()) }}</span>
        <span class="kpi__meta">{{ count(billing().invoices.length) }} invoices</span>
      </article>
    </section>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Plan</h2>
          <p class="card__sub">Price preview only; plan and billing changes are not connected in this demo.</p>
        </div>
        <div class="seg" role="group" aria-label="Billing cycle">
          <button type="button" class="seg__btn" [class.is-on]="cycle() === 'monthly'" [attr.aria-pressed]="cycle() === 'monthly'" (click)="cycle.set('monthly')">Monthly</button>
          <button type="button" class="seg__btn" [class.is-on]="cycle() === 'yearly'" [attr.aria-pressed]="cycle() === 'yearly'" (click)="cycle.set('yearly')">Yearly</button>
        </div>
      </div>
      <div class="card__body plans">
        @for (p of plans; track p.id) {
          <article class="plan" [class.is-current]="p.id === currentPlan().id">
            @if (p.id === currentPlan().id) {
              <span class="badge badge--good">Current</span>
            }
            <h3 class="plan__name">{{ p.name }}</h3>
            <p class="plan__blurb">{{ p.blurb }}</p>
            <p class="plan__price">
              <span class="plan__amount">{{ money(planPrice(p)) }}</span>
              <span class="plan__cycle">/ {{ cycle() === 'monthly' ? 'month' : 'year' }}</span>
            </p>
            <p class="plan__yearly">
              {{ cycle() === 'monthly' ? money(p.yearly) + ' billed yearly' : money(p.price) + ' per month' }}
            </p>
            <ul class="plan__features">
              @for (f of p.features; track f) {
                <li>{{ f }}</li>
              }
            </ul>
            @if (p.id === currentPlan().id) {
              <span class="hint">Current demo plan</span>
            }
          </article>
        }
      </div>
    </article>

    <div class="grid grid--2">
      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Payment method</h2>
            <p class="card__sub">Payment processing is not connected in this demo</p>
          </div>
        </div>
        <div class="card__body">
          <p class="hint">No payment card is stored or charged by this local application.</p>
        </div>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Seats</h2>
            <p class="card__sub">{{ currentPlan().name }} covers up to {{ planSeats() }}</p>
          </div>
          <span class="saved">Saved</span>
        </div>
        <div class="card__body">
          <div class="seatline">
            <span class="seatline__seats">{{ count(billing().seats) }} seats</span>
            <span class="seatline__use">{{ count(store.team().length) }} in use · {{ count(freeSeats()) }} available</span>
          </div>
          <div class="seatline__meter">
            <div class="meter__fill" [style.width.%]="seatPct()"></div>
          </div>
          <p class="hint">Seat counts are informational; team and plan changes are not processed here.</p>
          <div class="holders">
            @for (h of seatHolders(); track h) {
              <span class="av av--sm av--{{ h.tone }}" [title]="h.name">{{ h.initials }}</span>
            }
            <a class="holders__link" routerLink="/settings/team">Manage team</a>
          </div>
        </div>
      </article>
    </div>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Invoices</h2>
          <p class="card__sub">{{ billing().invoices.length }} sample invoices · {{ money(total()) }} in total</p>
        </div>
        <div class="seg" role="group" aria-label="Invoice status">
          @for (f of invoiceFilters; track f.id) {
            <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="filter.set(f.id)">
              {{ f.label }}
            </button>
          }
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Description</th>
              <th scope="col">Status</th>
              <th scope="col">Amount</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            @for (inv of visible(); track inv.id) {
              <tr>
                <td class="mono strong">{{ inv.id }}</td>
                <td>
                  {{ inv.description }}
                  <span class="sub">{{ inv.date }}</span>
                </td>
                <td><span class="badge" [class]="'badge badge--' + inv.tone">{{ inv.label }}</span></td>
                <td class="num">{{ money(inv.amount) }}</td>
                <td class="right"><button type="button" class="btn btn--xs btn--ghost" (click)="downloadInvoice(inv.source)">Download CSV</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </article>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    article.card { margin-bottom: var(--gap); }
    .card__body { display: grid; gap: 13px; }
    .grid { margin-bottom: var(--gap); }
    .plans { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
    .plan { display: grid; gap: 6px; align-content: start; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-tile); background: var(--surface-2, var(--surface)); }
    .plan.is-current { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary) inset; }
    .plan__name { font-size: var(--fs-lg); font-weight: 700; letter-spacing: -0.015em; margin: 0; }
    .plan__blurb { font-size: var(--fs-xs); color: var(--muted); margin: 0; }
    .plan__price { margin: 4px 0 0; display: flex; align-items: baseline; gap: 4px; }
    .plan__amount { font-size: var(--fs-2xl); font-weight: 700; letter-spacing: -0.02em; }
    .plan__cycle { font-size: var(--fs-xs); color: var(--muted); }
    .plan__yearly { margin: 0; font-size: var(--fs-2xs); color: var(--faint); }
    .plan__features { list-style: none; margin: 6px 0 10px; padding: 0; display: grid; gap: 4px; }
    .plan__features li { font-size: var(--fs-xs); color: var(--muted); padding-left: 16px; position: relative; }
    .plan__features li::before { content: ''; position: absolute; left: 4px; top: 0.55em; width: 5px; height: 5px; border-radius: 50%; background: var(--primary); }
    .seatline { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .seatline__seats { font-size: var(--fs-lg); font-weight: 700; }
    .seatline__use { font-size: var(--fs-xs); color: var(--muted); }
    .seatline__meter { height: 8px; border-radius: 999px; background: var(--well); overflow: hidden; }
    .meter__fill { height: 100%; border-radius: 999px; background: var(--primary); }
    .hint { margin: 0; font-size: var(--fs-2xs); color: var(--faint); }
    .holders { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .holders__link { margin-left: auto; font-size: var(--fs-xs); font-weight: 700; color: var(--primary); text-decoration: none; }
    .holders__link:hover { text-decoration: underline; }
    .saved { font-size: var(--fs-2xs); font-weight: 700; color: var(--primary); }
    .strong { font-weight: 700; }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .right { text-align: right; }
  `,
})
export class SettingsBilling {
  protected readonly store = inject(Store);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;
  protected readonly plans = PLANS;
  protected readonly cycle = signal<'monthly' | 'yearly'>('yearly');
  protected readonly filter = signal<InvoiceFilter>('all');
  protected readonly invoiceFilters: { id: InvoiceFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'paid', label: 'Paid' },
    { id: 'due', label: 'Due' },
  ];

  protected readonly billing = computed(() => this.store.settings().billing);
  protected readonly currentPlan = computed(
    () => PLANS.find((p) => p.name === this.billing().plan) ?? PLANS[1],
  );
  protected readonly selectedPrice = computed(() =>
    this.cycle() === 'monthly' ? this.currentPlan().price : this.currentPlan().yearly,
  );
  protected readonly freeSeats = computed(() =>
    Math.max(0, this.billing().seats - this.store.team().length),
  );

  protected readonly seatPct = computed(() => {
    const seats = this.billing().seats || 1;
    return Math.min(100, (this.store.team().length / seats) * 100);
  });

  protected readonly seatHolders = computed(() =>
    this.store.team().map((t) => ({
      name: t.name,
      initials: t.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join(''),
      tone: t.tone,
    })),
  );

  protected readonly total = computed(() =>
    this.billing().invoices.reduce((a, i) => a + i.amount, 0),
  );

  protected readonly paidThisYear = computed(() => {
    const year = new Date().getFullYear();
    return this.billing()
      .invoices.filter((i) => new Date(i.at).getFullYear() === year && i.status === 'paid')
      .reduce((a, i) => a + i.amount, 0);
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    const invoices = this.billing()
      .invoices.map((i) => {
        const d = new Date(i.at);
        return {
          id: i.id,
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          description: `Vessa ${this.billing().plan} Â· ${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
          status: i.status,
          label: statusLabel(i.status),
          tone: statusTone(i.status),
          amount: i.amount,
          source: i,
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
    if (f === 'all') return invoices;
    return invoices.filter((i) => (f === 'paid' ? i.status === 'paid' : i.status !== 'paid'));
  });

  protected planSeats(): string {
    const features = this.currentPlan().features;
    const seatLine = features.find((f) => f.toLowerCase().includes('seats'));
    return seatLine ? seatLine.replace('Up to ', '') : String(this.billing().seats);
  }

  protected planPrice(plan: Plan): number {
    return this.cycle() === 'monthly' ? plan.price : plan.yearly;
  }

  protected downloadInvoice(invoice: Settings['billing']['invoices'][number]): void {
    const date = new Date(invoice.at);
    const description = `Vessa ${this.billing().plan} · ${date.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
    const rows = [
      ['Invoice', 'Description', 'Status', 'Date', 'Amount'],
      [
        invoice.id,
        description,
        statusLabel(invoice.status),
        date.toISOString(),
        String(invoice.amount),
      ],
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.id}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
