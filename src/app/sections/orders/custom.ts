import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  CustomOrdersApiService,
  type ApiCustomOrderRequest,
  type CustomOrderStatus,
} from '../../core/custom-orders-api.service';
import { date as fmtDate, initials } from '../../core/format';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';

const STATUS_LABEL: Record<CustomOrderStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  quoted: 'Quoted',
  quote_accepted: 'Quote accepted',
  paid: 'Paid',
  sample_in_production: 'Sample in production',
  sample_approved: 'Sample approved',
  in_production: 'In production',
  fulfilled: 'Fulfilled',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

@Component({
  selector: 'app-orders-custom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule, DatePipe],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">Custom orders</h1>
        <p class="head__lead">{{ rows().length }} made-to-spec requests · {{ pending().length }} need attention</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/orders/all">All orders</a>
      </div>
    </div>

    <div class="stats" aria-label="Custom order summary">
      <article class="stat"><span class="stat__label">Total</span><strong class="stat__value">{{ rows().length }}</strong><span class="stat__detail">All submissions</span></article>
      <article class="stat"><span class="stat__label">Awaiting review</span><strong class="stat__value">{{ submitted().length }}</strong><span class="stat__detail">Needs first review</span></article>
      <article class="stat"><span class="stat__label">Quoted / waiting payment</span><strong class="stat__value">{{ quoted().length }}</strong><span class="stat__detail">Buyer hasn't paid yet</span></article>
      <article class="stat"><span class="stat__label">In production</span><strong class="stat__value">{{ inProduction().length }}</strong><span class="stat__detail">Sample or full runs active</span></article>
    </div>

    <div class="toolbar">
      <div class="stage-tabs" role="tablist" aria-label="Filter by status">
        @for (tab of tabs; track tab.id) {
          <button type="button" class="pill" role="tab" [class.is-on]="filter() === tab.id" (click)="filter.set(tab.id)">{{ tab.label }}</button>
        }
      </div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search buyer, location or description" aria-label="Search custom orders" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} requests</span>
    </div>

    @if (loading()) {
      <p class="note">Loading custom orders…</p>
    } @else if (loadError()) {
      <div class="empty"><strong>Couldn't load custom orders.</strong><span>{{ loadError() }}</span><button class="btn btn--ghost" type="button" (click)="load()">Retry</button></div>
    }

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th scope="col">Buyer</th><th scope="col">Details</th><th scope="col">Qty</th><th scope="col">Desired</th><th scope="col">Status</th><th scope="col">Updated</th></tr>
        </thead>
        <tbody>
          @for (row of visible(); track row.id) {
            <tr class="rowbtn" (click)="open(row.id)" (keydown.enter)="open(row.id)" tabindex="0">
              <td>
                <span class="cell-name"><span class="av av--sage">{{ initials(row.buyer.name || '?') }}</span><span>{{ row.buyer.name }}<span class="sub mono">{{ row.buyer.email }}</span></span></span>
              </td>
              <td class="cell-clip" [title]="row.description">{{ row.fabricQuality }} · {{ row.colours }}<span class="sub">{{ row.location }}</span></td>
              <td class="num">{{ row.quantity }}</td>
              <td>{{ row.desiredDate }}</td>
              <td><span class="badge" [class.badge--info]="row.status === 'submitted' || row.status === 'under_review'" [class.badge--warn]="row.status === 'quoted'" [class.badge--good]="row.status === 'delivered' || row.status === 'fulfilled'" [class.badge--bad]="row.status === 'rejected' || row.status === 'cancelled'">{{ labelOf(row.status) }}</span></td>
              <td>{{ row.updatedAt | date: 'mediumDate' }}</td>
            </tr>
          }
          @if (!visible().length && !loading() && !loadError()) {
            <tr><td colspan="6" class="table-empty">No requests match.</td></tr>
          }
        </tbody>
      </table>
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Custom order detail">
      <ng-container drawerTitle>
        @if (selected(); as o) {
          <div class="dtitle"><strong>{{ o.buyer.name }}</strong><span class="dmeta">{{ o.fabricQuality }} · {{ o.quantity }} units</span></div>
        }
      </ng-container>
      @if (selected(); as o) {
        <div class="dbody">
          <div class="dsummary">
            <div><span class="stat__label">Buyer</span><span class="dmeta">{{ o.buyer.email }}<span class="sub">{{ o.location }}</span></span></div>
            <div class="dright"><span class="stat__label">Status</span><strong>{{ labelOf(o.status) }}</strong></div>
          </div>

          <dl class="facts">
            <div><dt>Sizes</dt><dd>{{ o.sizes }}</dd></div>
            <div><dt>Colours</dt><dd>{{ o.colours }}</dd></div>
            <div><dt>Quantity</dt><dd>{{ o.quantity }}</dd></div>
            <div><dt>Desired date</dt><dd>{{ o.desiredDate }}</dd></div>
            <div><dt>Fabric</dt><dd>{{ o.fabricQuality }}</dd></div>
            <div><dt>Submitted</dt><dd>{{ o.createdAt | date: 'medium' }}</dd></div>
          </dl>
          <h3 class="dlabel">Buyer's description</h3>
          <p class="dnote">{{ o.description }}</p>

          <h3 class="dlabel">Actions</h3>
          <div class="actions">
            @if (o.status === 'submitted') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="startReview()">Start review</button>
            }
            @if (o.status === 'under_review' || o.status === 'submitted') {
              <form class="quote-form" (ngSubmit)="sendQuote()">
                <div class="cost-grid">
                  <label class="field"><span class="field-label">Amount (₦)</span><input type="number" min="0.01" step="0.01" [(ngModel)]="quoteForm.amount" name="amount" required /></label>
                  <label class="field"><span class="field-label">Note</span><input type="text" [(ngModel)]="quoteForm.note" name="note" placeholder="Fabric + making + delivery" /></label>
                </div>
                <button class="btn btn--primary" type="submit" [disabled]="busy() || !quoteForm.amount">Send quote</button>
              </form>
            }
            @if (o.status === 'quote_accepted' || o.status === 'quoted') {
              <button class="btn btn--ghost" type="button" [disabled]="busy() || paymentOpen()" (click)="openPayment()">Record payment</button>
              @if (paymentOpen()) {
                <form class="quote-form" (ngSubmit)="recordPayment()">
                  <div class="cost-grid">
                    <label class="field"><span class="field-label">Method</span>
                      <select [(ngModel)]="payForm.method" name="method">
                        <option value="paystack">Paystack</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                        <option value="pos">POS</option>
                      </select>
                    </label>
                    <label class="field"><span class="field-label">Amount (₦) — must match quote</span><input type="number" min="0.01" step="0.01" [(ngModel)]="payForm.amount" name="payamount" required /></label>
                  </div>
                  <div class="actions-row">
                    <button class="btn btn--primary" type="submit" [disabled]="busy() || !payForm.amount">Confirm payment</button>
                    <button class="btn btn--ghost" type="button" (click)="paymentOpen.set(false)">Cancel</button>
                  </div>
                </form>
              }
            }
            @if (o.status === 'paid') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="setStatus('sample_in_production')">Start sample production</button>
            }
            @if (o.status === 'sample_in_production') {
              <div class="actions-row">
                <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="decideSample(true)">Sample approved</button>
                <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="decideSample(false)">Sample rejected</button>
              </div>
              <label class="field"><span class="field-label">Sample decision note</span><input type="text" [(ngModel)]="sampleNote" name="sampleNote" placeholder="optional" /></label>
            }
            @if (o.status === 'sample_approved') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="setStatus('in_production')">Start full production</button>
            }
            @if (o.status === 'in_production') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="setStatus('fulfilled')">Mark fulfilled</button>
            }
            @if (o.status === 'fulfilled') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="setStatus('delivered')">Mark delivered</button>
            }
            @if (!isClosed(o.status)) {
              <button class="btn btn--ghost destructive" type="button" [disabled]="busy()" (click)="reject()">Reject request</button>
            }
          </div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .note { padding: 14px 16px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); font-size: var(--fs-sm); }
    .stage-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { border: 1px solid var(--line); background: var(--surface); color: var(--muted); border-radius: var(--sd-r-pill); padding: 5px 12px; font-size: var(--fs-xs); font-weight: 650; cursor: pointer; }
    .pill.is-on { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
    .cell-name { display: flex; align-items: center; gap: 10px; }
    .cell-clip { max-width: 260px; }
    .sub { display: block; color: var(--faint); font-size: var(--fs-xs); }
    .rowbtn { cursor: pointer; }
    .rowbtn:hover td { background: var(--well); }
    .table-empty { text-align: center; color: var(--muted); padding: 30px 12px; }
    .dbody { display: grid; gap: 16px; }
    .dtitle strong { display: block; }
    .dmeta { color: var(--faint); font-size: var(--fs-xs); }
    .dsummary { display: flex; justify-content: space-between; gap: 16px; }
    .dright { display: grid; justify-items: end; text-align: right; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dnote { font-size: var(--fs-md); color: var(--muted); line-height: 1.5; }
    .actions, .quote-form, .actions-row { display: grid; gap: 10px; }
    .actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .cost-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .destructive { color: var(--bad); }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    @media (max-width: 900px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cost-grid { grid-template-columns: 1fr; } }
  `,
})
export class OrdersCustom {
  private readonly api = inject(CustomOrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly date = fmtDate;
  protected readonly initials = initials;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rows = signal<ApiCustomOrderRequest[]>([]);
  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly paymentOpen = signal(false);

  protected readonly quoteForm = { amount: 0, note: '' };
  protected readonly payForm: { method: 'paystack' | 'cash' | 'pos' | 'bank_transfer'; amount: number } = { method: 'paystack', amount: 0 };
  protected sampleNote = '';

  protected readonly tabs = [
    { id: 'all', label: 'All' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'review', label: 'In review' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'paid', label: 'Paid' },
    { id: 'production', label: 'In production' },
    { id: 'closed', label: 'Closed' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  protected labelOf(status: CustomOrderStatus): string {
    return STATUS_LABEL[status] ?? status;
  }

  protected isClosed(status: CustomOrderStatus): boolean {
    return status === 'delivered' || status === 'rejected' || status === 'cancelled';
  }

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((row) => {
      if (f === 'submitted' && row.status !== 'submitted') return false;
      if (f === 'review' && row.status !== 'under_review') return false;
      if (f === 'quoted' && !['quoted', 'quote_accepted'].includes(row.status)) return false;
      if (f === 'paid' && row.status !== 'paid') return false;
      if (f === 'production' && !['sample_in_production', 'sample_approved', 'in_production'].includes(row.status)) return false;
      if (f === 'closed' && !this.isClosed(row.status) && row.status !== 'fulfilled') return false;
      if (!q) return true;
      const haystack = `${row.buyer.name} ${row.buyer.email} ${row.description} ${row.location} ${row.fabricQuality} ${row.colours}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  protected readonly pending = computed(() => this.rows().filter((r) => r.status === 'submitted' || r.status === 'under_review'));
  protected readonly submitted = computed(() => this.rows().filter((r) => r.status === 'submitted'));
  protected readonly quoted = computed(() => this.rows().filter((r) => r.status === 'quoted' || r.status === 'quote_accepted'));
  protected readonly inProduction = computed(() => this.rows().filter((r) => ['sample_in_production', 'sample_approved', 'in_production'].includes(r.status)));

  protected readonly selected = computed(() => this.rows().find((r) => r.id === (this.selectedId() ?? this.routeId())) ?? null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const result = await this.api.list(1, 200);
      this.rows.set(result.data);
    } catch {
      this.loadError.set('The custom orders service is unreachable. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected open(id: string): void {
    this.selectedId.set(id);
    this.paymentOpen.set(false);
    this.quoteForm.amount = 0;
    this.quoteForm.note = '';
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  protected async startReview(): Promise<void> {
    const o = this.selected();
    if (!o) return;
    this.busy.set(true);
    try {
      await this.api.updateStatus(o.id, { status: 'under_review' });
      this.toast.show('Request moved to review', 'good');
      await this.load();
    } catch {
      this.toast.show('Could not update the request.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendQuote(): Promise<void> {
    const o = this.selected();
    if (!o) return;
    this.busy.set(true);
    try {
      await this.api.sendQuotation(o.id, { amount: Number(this.quoteForm.amount), note: this.quoteForm.note.trim() || undefined });
      await this.api.updateStatus(o.id, { status: 'quoted' });
      this.toast.show('Quote sent to the buyer', 'good');
      this.quoteForm.amount = 0;
      this.quoteForm.note = '';
      await this.load();
    } catch {
      this.toast.show('Could not send the quote — check the amount.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected openPayment(): void {
    const o = this.selected();
    this.paymentOpen.set(true);
    if (o) void this.api.quotation(o.id).then((q) => (this.payForm.amount = q.amount)).catch(() => undefined);
  }

  protected async recordPayment(): Promise<void> {
    const o = this.selected();
    if (!o) return;
    this.busy.set(true);
    try {
      await this.api.recordPayment(o.id, { method: this.payForm.method, amount: Number(this.payForm.amount) });
      this.toast.show('Payment recorded', 'good');
      this.paymentOpen.set(false);
      await this.load();
    } catch {
      this.toast.show('Payment rejected — amount must match the quote exactly.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async decideSample(approved: boolean): Promise<void> {
    const o = this.selected();
    if (!o) return;
    this.busy.set(true);
    try {
      await this.api.recordSampleDecision(o.id, { approved, note: this.sampleNote.trim() || undefined });
      this.toast.show(approved ? 'Sample approved — full production can start' : 'Sample rejected — request paused', 'good');
      this.sampleNote = '';
      await this.load();
    } catch {
      this.toast.show('Could not record the sample decision.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatus(status: CustomOrderStatus): Promise<void> {
    const o = this.selected();
    if (!o) return;
    this.busy.set(true);
    try {
      await this.api.updateStatus(o.id, { status });
      this.toast.show('Request updated', 'good');
      await this.load();
    } catch {
      this.toast.show('Could not update the request.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async reject(): Promise<void> {
    await this.setStatus('rejected');
  }
}
