import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuditApiService, type ApiAuditEntry, type ApiAuditVerify } from '../../core/audit-api.service';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { date as fmtDate, money } from '../../core/format';

interface AuditChange {
  label: string;
  value: string;
}

interface AuditRow {
  id: string;
  at: number;
  actorId: string;
  whoName: string;
  action: string;
  text: string;
  beforeState: unknown;
  afterState: unknown;
  orderNumber: string;
  customerName: string;
  orderTotal: string;
  itemSummary: string;
  changes: AuditChange[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function isStockRefund(action: string): boolean {
  return /\/orders\/[^/]+\/stock-exception\/refund\/?$/.test(action);
}

function stockRefundChanges(state: Record<string, unknown>): AuditChange[] {
  const changes: AuditChange[] = [];
  if (state['status'] === 'cancelled') {
    changes.push({ label: 'Order status', value: 'Cancelled' });
  }
  if (state['paymentStatus'] === 'refunded') {
    changes.push({ label: 'Payment', value: 'Refunded' });
  }
  const items = state['items'];
  if (Array.isArray(items)) {
    const unavailable = items.reduce((total, item) => {
      const shortfall = asRecord(item)?.['shortfall'];
      return total + (typeof shortfall === 'number' ? shortfall : 0);
    }, 0);
    if (unavailable > 0) {
      changes.push({
        label: 'Stock issue',
        value: `${unavailable} ${unavailable === 1 ? 'item was' : 'items were'} unavailable`,
      });
    }
  }
  return changes;
}

function describeAction(action: string, stockRefund: boolean): string {
  if (stockRefund) return 'Refunded an order after a stock shortage';
  const route = action.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, '').replace(/^\/api\/v\d+\//, '');
  const readable = route
    .split('/')
    .filter((part) => part && !/^(:id|\d+|[0-9a-f]{8}-[0-9a-f-]{27,})$/i.test(part))
    .map((part) => part.replace(/[-_]/g, ' '))
    .join(' ')
    .trim();
  return readable ? `Updated ${readable}` : 'Updated a record';
}

function describeRefund(state: Record<string, unknown>): string {
  const orderNumber = stringValue(state['orderNumber']);
  const customerName = stringValue(state['guestName']);
  const items = Array.isArray(state['items']) ? state['items'] : [];
  const unavailable = items.reduce((total, item) => {
    const shortfall = asRecord(item)?.['shortfall'];
    return total + (typeof shortfall === 'number' ? shortfall : 0);
  }, 0);
  const order = orderNumber ? `Order #${orderNumber}` : 'The order';
  const customer = customerName ? ` for ${customerName}` : '';
  const stockIssue =
    unavailable > 0
      ? ` ${unavailable} ${unavailable === 1 ? 'item was' : 'items were'} unavailable.`
      : '';
  return `${order}${customer} was cancelled and the payment was refunded.${stockIssue}`;
}

@Component({
  selector: 'app-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Audit</span>
        <h1 class="head__title">Audit log</h1>
        <p class="head__lead">
          {{ entries().length }} entries · chain {{ chainStatus() }}
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Audit summary">
      <article class="stat">
        <span class="stat__label">Total entries</span>
        <strong class="stat__value">{{ entries().length }}</strong>
        <span class="stat__detail">Logged audit events</span>
      </article>
      <article class="stat">
        <span class="stat__label">Valid blocks</span>
        <strong class="stat__value">{{ chain().valid }}</strong>
        <span class="stat__detail">Hash-verified entries</span>
      </article>
      <article class="stat">
        <span class="stat__label">Broken blocks</span>
        <strong class="stat__value" [class.is-bad]="chain().broken > 0">{{ chain().broken }}</strong>
        <span class="stat__detail">Integrity failures</span>
      </article>
      <article class="stat">
        <span class="stat__label">Head hash</span>
        <strong class="stat__value mono">{{ chain().headHash }}</strong>
        <span class="stat__detail">Current chain tip</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search actor or action" aria-label="Search audit log" [value]="query()" (input)="query.set($any($event.target).value)" />
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

    <div class="audit-grid" aria-label="Audit entries">
      @for (row of visible(); track row.id) {
        <button type="button" class="audit-card" (click)="open(row.id)" [attr.aria-label]="'Audit entry ' + row.id + ' ' + row.action">
          <span class="audit-card__top">
            <span class="audit-card__id">{{ row.action }}</span>
            <span class="audit-card__at">{{ date(row.at) }}</span>
          </span>
          <span class="audit-card__actor">
            <span>{{ row.whoName }}</span>
          </span>
          <span class="audit-card__text">
            {{ row.text }}
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="audit-empty">
          <strong>No audit entries match.</strong>
          <span>Try another actor, action or date range.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Audit entry detail">
      <ng-container drawerTitle>
        @if (selected(); as e) {
          <div class="dtitle">
            <strong>{{ e.action }}</strong>
            <span>{{ date(e.at) }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as e) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Recorded by</dt><dd>{{ e.whoName }}</dd></div>
            @if (e.orderNumber) {
              <div><dt>Order</dt><dd>#{{ e.orderNumber }}</dd></div>
            }
            @if (e.customerName) {
              <div><dt>Customer</dt><dd>{{ e.customerName }}</dd></div>
            }
            @if (e.orderTotal) {
              <div><dt>Order total</dt><dd>{{ e.orderTotal }}</dd></div>
            }
            @if (e.itemSummary) {
              <div><dt>Items</dt><dd>{{ e.itemSummary }}</dd></div>
            }
          </dl>

          <section class="change-summary" aria-label="What changed">
            <h3 class="dlabel">What changed</h3>
            @if (e.changes.length) {
              <ul class="change-list">
                @for (change of e.changes; track change.label) {
                  <li><strong>{{ change.label }}</strong><span>{{ change.value }}</span></li>
                }
              </ul>
            } @else {
              <p>{{ e.text }}</p>
            }
          </section>

          <details class="technical-record">
            <summary>Technical record</summary>
            <p>Audit entry ID: {{ e.id }}</p>
            <p>Team member ID: {{ e.actorId }}</p>
            <p>Recorded action: {{ e.action }}</p>
            <h3 class="dlabel">Before</h3>
            <pre class="dpayload">{{ payloadText(e.beforeState) }}</pre>
            <h3 class="dlabel">Recorded data</h3>
            <pre class="dpayload">{{ payloadText(e.afterState) }}</pre>
          </details>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .audit-grid { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 10px; }
    .audit-card { display: grid; gap: 12px; width: 100%; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .audit-card:hover { border-color: var(--primary); }
    .audit-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .audit-card__top, .audit-card__actor { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .audit-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .audit-card__at { color: var(--muted); font-size: var(--fs-sm); }
    .audit-card__actor { justify-content: flex-start; gap: 10px; color: var(--muted); font-size: var(--fs-sm); }
    .audit-card__action { color: var(--muted); font-size: var(--fs-xs); }
    .audit-card__text { color: var(--text); font-size: var(--fs-sm); white-space: pre-wrap; }
    .audit-card__href { color: var(--faint); font-size: var(--fs-xs); }
    .audit-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .audit-empty strong { color: var(--text); }
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
    .dpayload { font-family: var(--fs-mono, monospace); font-size: var(--fs-2xs); white-space: pre-wrap; word-break: break-all; background: var(--well); border: 1px solid var(--line); border-radius: var(--r-card); padding: 10px; color: var(--muted); margin: 8px 0; }
    .change-summary p { margin: 0; color: var(--text); }
    .change-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .change-list li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-card); }
    .change-list li span { text-align: right; }
    .technical-record { color: var(--muted); font-size: var(--fs-sm); }
    .technical-record summary { cursor: pointer; color: var(--muted); }
    .technical-record p { overflow-wrap: anywhere; }
    .is-bad { color: var(--bad); }
    .mono { font-family: var(--fs-mono, monospace); }
  `,
})
export class AuditLog {
  private readonly auditApi = inject(AuditApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly date = fmtDate;

  protected readonly query = signal('');
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly entries = signal<AuditRow[]>([]);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly chain = signal<ApiAuditVerify>({ total: 0, valid: 0, broken: 0, headHash: '—' });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const [entriesResult, chain] = await Promise.all([
      this.auditApi.list(1, 100),
      this.auditApi.verify(),
    ]);
    this.entries.set(
      entriesResult.data.map((e) => {
        const stockRefund = isStockRefund(e.action);
        const state = asRecord(e.afterState);
        const items = Array.isArray(state?.['items']) ? state['items'] : [];
        const totalAmount = state?.['totalAmount'];
        const action = describeAction(e.action, stockRefund);
        return {
          id: e.id,
          at: Date.parse(e.timestamp) || 0,
          actorId: e.actorId ?? 'system',
          whoName: e.actorId ? 'Team member' : 'System',
          action,
          text: stockRefund && state ? describeRefund(state) : action,
          beforeState: e.beforeState,
          afterState: e.afterState,
          orderNumber: stringValue(state?.['orderNumber']),
          customerName: stringValue(state?.['guestName']),
          orderTotal: typeof totalAmount === 'number' ? money(totalAmount) : '',
          itemSummary: `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
          changes: stockRefund && state ? stockRefundChanges(state) : [],
        };
      }),
    );
    this.chain.set(chain);
  }

  protected readonly visible = computed(() => {
    const list = this.entries();
    const q = this.query().trim().toLowerCase();
    return list
      .filter((e) => {
        if (!q) return true;
        const haystack = `${e.whoName} ${e.action} ${e.text} ${e.orderNumber} ${e.customerName}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.at - a.at);
  });

  protected readonly chainStatus = computed(() => {
    const c = this.chain();
    if (c.broken > 0) return 'broken';
    if (c.total > 0 && c.valid === c.total) return 'valid';
    return 'unknown';
  });

  protected readonly selected = computed(() => this.entries().find((e) => e.id === this.routeId()));

  protected payloadText(value: unknown): string {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  protected open(id: string): void {
    this.router.navigate(['/audit/log', id]);
  }

  protected close(): void {
    this.router.navigate(['/audit/log']);
  }
}
