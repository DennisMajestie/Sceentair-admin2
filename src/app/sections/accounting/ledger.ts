import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { date as fmtDate, money as fmtMoney } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { ToastService } from '../../core/toast';
import {
  AccountingApiService,
  type ApiLedgerEntry,
  type LedgerEntryType,
} from '../../core/accounting-api.service';

function errorText(err: unknown): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : String(err);
}

/** `retail_sale` → `Retail Sale`; falls back for entries without a category. */
function categoryLabel(value: string | null): string {
  if (!value) return 'Uncategorized';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const ENTRY_TYPES: { id: LedgerEntryType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sale', label: 'Sale' },
  { id: 'investment', label: 'Investment' },
  { id: 'expense', label: 'Expense' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'tax', label: 'Tax' },
];

const TYPE_TONE: Record<LedgerEntryType, string> = {
  sale: 'sage',
  investment: 'sage',
  expense: 'bad',
  purchase: 'warn',
  payroll: 'warn',
  tax: 'muted',
};

@Component({
  selector: 'app-accounting-ledger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Finance</span>
        <h1 class="head__title">Accounting ledger</h1>
        <p class="head__lead">
          {{ entries().length }} entries · net {{ money(netBalance()) }}
        </p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--primary" (click)="openForm()">
          <app-icon name="plus" [size]="15" />
          Record entry
        </button>
        <a class="btn btn--ghost" routerLink="/accounting/ledger">Refresh</a>
      </div>
    </div>

    @if (formOpen()) {
      <form class="entry-bar" (ngSubmit)="submitEntry()">
        <div class="entry-bar__fields">
          <label class="field"><span class="field__label">Type</span>
            <select [(ngModel)]="entryForm.type" name="ledgerType">
              <option value="income">Income</option>
              <option value="expenditure">Expenditure</option>
            </select>
          </label>
          <label class="field"><span class="field__label">Amount</span><input type="number" min="0.01" step="0.01" [(ngModel)]="entryForm.amount" name="ledgerAmount" required /></label>
          <label class="field"><span class="field__label">Occurred at</span><input type="date" [(ngModel)]="entryForm.occurredAt" name="ledgerOccurredAt" /></label>
          <label class="field entry-bar__note"><span class="field__label">Note</span><input type="text" [(ngModel)]="entryForm.note" name="ledgerNote" placeholder="What was recorded" required /></label>
        </div>
        <div class="entry-bar__actions">
          <button type="submit" class="btn btn--primary" [disabled]="saving()">Save entry</button>
          <button type="button" class="btn btn--ghost" (click)="closeForm()">Cancel</button>
        </div>
      </form>
    }

    <div class="stats" aria-label="Ledger summary">
      <article class="stat">
        <span class="stat__label">Money in</span>
        <strong class="stat__value">{{ money(moneyIn()) }}</strong>
        <span class="stat__detail">Sales and investment</span>
      </article>
      <article class="stat">
        <span class="stat__label">Money out</span>
        <strong class="stat__value">{{ money(moneyOut()) }}</strong>
        <span class="stat__detail">Expense, purchase, payroll and tax</span>
      </article>
      <article class="stat">
        <span class="stat__label">Net balance</span>
        <strong class="stat__value">{{ money(netBalance()) }}</strong>
        <span class="stat__detail">In minus out</span>
      </article>
      <article class="stat">
        <span class="stat__label">Entries</span>
        <strong class="stat__value">{{ entries().length }}</strong>
        <span class="stat__detail">Ledger records</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Entry type filter">
        @for (f of entryTypes; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="entryType() === f.id" [attr.aria-pressed]="entryType() === f.id" (click)="entryType.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search category or reference" aria-label="Search ledger entries" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <label class="date">
        <span>From</span>
        <input type="date" [value]="dateFrom() || ''" (input)="dateFrom.set($any($event.target).value || null)" />
      </label>
      <label class="date">
        <span>To</span>
        <input type="date" [value]="dateTo() || ''" (input)="dateTo.set($any($event.target).value || null)" />
      </label>
      <span class="badge">{{ visible().length }} entries</span>
    </div>

    <div class="ledger-grid" aria-label="Ledger entries">
      @for (row of visible(); track row.id) {
        <button type="button" class="ledger-card" (click)="open(row.id)" [attr.aria-label]="'Entry ' + row.id + ' ' + row.type">
          <span class="ledger-card__top">
            <span class="mono ledger-card__id">{{ row.id }}</span>
            <span class="badge" [class]="'badge badge--' + tone(row.type)">{{ row.type }}</span>
          </span>
          <span class="ledger-card__category">
            <span>{{ categoryLabel(row.category) }}</span>
            <span class="ledger-card__amount">{{ money(row.amount) }}</span>
          </span>
          <span class="ledger-card__meta">
            <span>{{ date(row.entryAt) }}</span>
            <span>{{ personName(row.recordedBy) }}</span>
          </span>
          <span class="ledger-card__reference">
            {{ row.referenceId ?? '—' }}
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="ledger-empty">
          <strong>No ledger entries match.</strong>
          <span>Try another type, date range or search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Ledger entry detail">
      <ng-container drawerTitle>
        @if (selected(); as entry) {
          <div class="dtitle">
            <strong class="mono">{{ entry.id }}</strong>
            <span class="badge" [class]="'badge badge--' + tone(entry.type)">{{ entry.type }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as entry) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Type</span>
              <span class="dmeta">{{ entry.type }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Amount</span>
              <strong class="dtotal">{{ money(entry.amount) }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Category</dt><dd>{{ categoryLabel(entry.category) }}</dd></div>
            <div><dt>Recorded</dt><dd>{{ date(entry.entryAt) }}</dd></div>
            <div><dt>Recorded by</dt><dd>{{ personName(entry.recordedBy) }}</dd></div>
            <div><dt>Reference</dt><dd>{{ entry.referenceId ?? '—' }}</dd></div>
          </dl>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .ledger-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .ledger-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .ledger-card:hover { border-color: var(--primary); }
    .ledger-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .ledger-card__top, .ledger-card__meta, .ledger-card__reference { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ledger-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .ledger-card__category { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ledger-card__amount { color: var(--text); font-size: var(--fs-md); font-weight: 700; white-space: nowrap; }
    .ledger-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .ledger-card__reference { color: var(--faint); font-size: var(--fs-xs); }
    .ledger-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .ledger-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .entry-bar { display: grid; gap: 12px; margin-bottom: var(--gap); padding: 16px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); box-shadow: var(--shadow); }
    .entry-bar__fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .entry-bar__note { grid-column: 1 / -1; }
    .entry-bar__actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .field { display: grid; gap: 5px; min-width: 0; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    @media (max-width: 1100px) { .ledger-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .entry-bar__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .ledger-grid { grid-template-columns: 1fr; } }
  `,
})
export class AccountingLedger {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly toasts = inject(ToastService);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly categoryLabel = categoryLabel;

  protected readonly query = signal('');
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly entryType = signal<LedgerEntryType | 'all'>('all');

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly entryForm = {
    type: 'income' as 'income' | 'expenditure',
    amount: 0,
    note: '',
    occurredAt: '',
  };

  protected readonly entryTypes = ENTRY_TYPES;

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly entries = computed(() => {
    const list = this.store.ledgerEntries();
    return list.filter((entry) => {
      if (this.entryType() !== 'all' && entry.type !== this.entryType()) return false;
      if (this.query()) {
        const q = this.query().trim().toLowerCase();
        const haystack = `${categoryLabel(entry.category)} ${entry.referenceId ?? ''} ${this.personName(entry.recordedBy)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (this.dateFrom() && entry.entryAt < Date.parse(this.dateFrom()!)) return false;
      if (this.dateTo() && entry.entryAt > Date.parse(this.dateTo()!)) return false;
      return true;
    }).sort((a, b) => b.entryAt - a.entryAt);
  });

  protected readonly visible = computed(() => this.entries());

  protected readonly moneyIn = computed(() =>
    this.entries().filter((e) => e.type === 'sale' || e.type === 'investment').reduce((a, e) => a + e.amount, 0),
  );
  protected readonly moneyOut = computed(() =>
    this.entries().filter((e) => e.type === 'expense' || e.type === 'purchase' || e.type === 'payroll' || e.type === 'tax').reduce((a, e) => a + e.amount, 0),
  );
  protected readonly netBalance = computed(() => this.moneyIn() - this.moneyOut());

  protected readonly tone = (type: LedgerEntryType): string => TYPE_TONE[type] ?? 'muted';

  /** Resolve a ledger actor id to a teammate name; never leak the raw uuid. */
  protected personName(id: string | null): string {
    if (!id) return '—';
    return this.store.teammateById()[id]?.name ?? '—';
  }

  protected readonly selected = computed(() => this.entries().find((e) => e.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/accounting/ledger', id]);
  }

  protected close(): void {
    this.router.navigate(['/accounting/ledger']);
  }

  protected openForm(): void {
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected async submitEntry(): Promise<void> {
    const amount = Number(this.entryForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.toasts.show('Amount must be greater than zero.', 'bad');
      return;
    }
    const note = this.entryForm.note.trim();
    if (!note) {
      this.toasts.show('Note is required.', 'bad');
      return;
    }
    this.saving.set(true);
    try {
      await this.accountingApi.recordEntry({
        type: this.entryForm.type,
        amount,
        note,
        ...(this.entryForm.occurredAt ? { occurredAt: this.entryForm.occurredAt } : {}),
      });
      this.toasts.show('Ledger entry recorded', 'good');
      this.formOpen.set(false);
      this.entryForm.type = 'income';
      this.entryForm.amount = 0;
      this.entryForm.note = '';
      this.entryForm.occurredAt = '';
      void this.store.load();
    } catch (err) {
      this.toasts.show(errorText(err), 'bad');
    } finally {
      this.saving.set(false);
    }
  }
}
