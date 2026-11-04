import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  ApprovalsApiService,
  type ApprovalActionType,
  type ApprovalStatus,
  type ApprovalDecision,
} from '../../core/approvals-api.service';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { date as fmtDate } from '../../core/format';

interface ApprovalRow {
  id: string;
  actionType: ApprovalActionType;
  payload: Record<string, unknown> | null;
  requestedBy: string | null;
  status: ApprovalStatus;
  approvedBy: string | null;
  justification: string | null;
  decidedAt: number | null;
  createdAt: number;
}

const ACTION_LABELS: Record<ApprovalActionType, string> = {
  purchasing: 'Purchasing',
  production_start: 'Production start',
  price_change: 'Price change',
  fund_movement: 'Fund movement',
  stock_disposal: 'Stock disposal',
};

const STATUS_TONE: Record<ApprovalStatus, string> = {
  pending: 'warn',
  approved: 'sage',
  rejected: 'bad',
};

@Component({
  selector: 'app-approvals-pending',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Approvals</span>
        <h1 class="head__title">Approval queue</h1>
        <p class="head__lead">
          {{ pendingCount() }} pending · {{ decisionsCount() }} decided
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Approval summary">
      <article class="stat">
        <span class="stat__label">Pending</span>
        <strong class="stat__value">{{ pendingCount() }}</strong>
        <span class="stat__detail">Awaiting decision</span>
      </article>
      <article class="stat">
        <span class="stat__label">Approved</span>
        <strong class="stat__value">{{ approvedCount() }}</strong>
        <span class="stat__detail">Decided this session</span>
      </article>
      <article class="stat">
        <span class="stat__label">Rejected</span>
        <strong class="stat__value">{{ rejectedCount() }}</strong>
        <span class="stat__detail">Decided this session</span>
      </article>
      <article class="stat">
        <span class="stat__label">Total</span>
        <strong class="stat__value">{{ approvals().length }}</strong>
        <span class="stat__detail">All requests</span>
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
        <input type="search" placeholder="Search action type or requester" aria-label="Search approvals" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} requests</span>
    </div>

    <div class="approval-grid" aria-label="Approval requests">
      @for (row of visible(); track row.id) {
        <button type="button" class="approval-card" (click)="open(row.id)" [attr.aria-label]="'Approval ' + row.id + ' ' + row.actionType">
          <span class="approval-card__top">
            <span class="mono approval-card__id">{{ row.id }}</span>
            <span class="badge" [class]="'badge badge--' + tone(row.status)">{{ row.status }}</span>
          </span>
          <span class="approval-card__action">
            <span>{{ actionLabel(row.actionType) }}</span>
            <span class="approval-card__requester">{{ row.requestedBy ?? '—' }}</span>
          </span>
          <span class="approval-card__meta">
            <span>{{ date(row.createdAt) }}</span>
            <span>{{ row.decidedAt ? date(row.decidedAt) : 'Pending' }}</span>
          </span>
          <span class="approval-card__justification">
            {{ row.justification ?? '—' }}
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="approval-empty">
          <strong>No approval requests match.</strong>
          <span>Try another status or search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Approval decision">
      <ng-container drawerTitle>
        @if (selected(); as a) {
          <div class="dtitle">
            <strong class="mono">{{ a.id }}</strong>
            <span class="badge" [class]="'badge badge--' + tone(a.status)">{{ a.status }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as a) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Action</span>
              <span class="dmeta">{{ actionLabel(a.actionType) }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Status</span>
              <strong class="dtotal">{{ a.status }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Requested by</dt><dd>{{ a.requestedBy ?? '—' }}</dd></div>
            <div><dt>Created</dt><dd>{{ date(a.createdAt) }}</dd></div>
            <div><dt>Decided</dt><dd>{{ a.decidedAt ? date(a.decidedAt) : 'Pending' }}</dd></div>
            <div><dt>Decided by</dt><dd>{{ a.approvedBy ?? '—' }}</dd></div>
          </dl>

          <h3 class="dlabel">Justification</h3>
          <p class="dnote">{{ a.justification ?? 'No justification provided.' }}</p>

          @if (a.payload) {
            <h3 class="dlabel">Payload</h3>
            <pre class="dpayload">{{ payloadText(a.payload) }}</pre>
          }

          @if (a.status === 'pending') {
            <div class="ddecide">
              <button type="button" class="btn" (click)="decide(a.id, 'approved')">
                Approve
              </button>
              <button type="button" class="btn btn--ghost" (click)="decide(a.id, 'rejected')">
                Reject
              </button>
            </div>
          }
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .approval-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .approval-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .approval-card:hover { border-color: var(--primary); }
    .approval-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .approval-card__top, .approval-card__meta, .approval-card__justification { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .approval-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .approval-card__action { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .approval-card__requester { color: var(--muted); font-size: var(--fs-sm); }
    .approval-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .approval-card__justification { color: var(--faint); font-size: var(--fs-xs); }
    .approval-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .approval-empty strong { color: var(--text); }
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
    .dnote { font-size: var(--fs-md); color: var(--muted); margin-bottom: 12px; }
    .dpayload { font-family: var(--fs-mono, monospace); font-size: var(--fs-2xs); white-space: pre-wrap; word-break: break-all; background: var(--well); border: 1px solid var(--line); border-radius: var(--r-card); padding: 10px; color: var(--muted); margin: 8px 0; }
    .ddecide { display: flex; gap: 10px; margin-top: 12px; }
    @media (max-width: 1100px) { .approval-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .approval-grid { grid-template-columns: 1fr; } }
  `,
})
export class ApprovalsPending {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly approvalsApi = inject(ApprovalsApiService);

  protected readonly date = fmtDate;

  protected readonly query = signal('');
  protected readonly status = signal<ApprovalStatus | 'all'>('all');
  protected readonly approvals = signal<ApprovalRow[]>([]);

  protected readonly statuses: { id: ApprovalStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const result = await this.approvalsApi.list({ page: 1, limit: 100 });
    this.approvals.set(
      result.data.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        payload: a.payload,
        requestedBy: a.requestedBy,
        status: a.status,
        approvedBy: a.approvedBy,
        justification: a.justification,
        decidedAt: Date.parse(a.decidedAt ?? '') || null,
        createdAt: Date.parse(a.createdAt) || 0,
      })),
    );
  }

  protected readonly actionLabel = (type: ApprovalActionType): string => ACTION_LABELS[type] ?? type;

  protected readonly visible = computed(() => {
    const list = this.approvals();
    const q = this.query().trim().toLowerCase();
    return list
      .filter((a) => {
        if (this.status() !== 'all' && a.status !== this.status()) return false;
        if (!q) return true;
        const haystack = `${a.actionType} ${a.requestedBy ?? ''} ${a.justification ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  });

  protected readonly pendingCount = computed(() =>
    this.approvals().filter((a) => a.status === 'pending').length,
  );
  protected readonly approvedCount = computed(() =>
    this.approvals().filter((a) => a.status === 'approved').length,
  );
  protected readonly rejectedCount = computed(() =>
    this.approvals().filter((a) => a.status === 'rejected').length,
  );
  protected readonly decisionsCount = computed(() => this.approvedCount() + this.rejectedCount());

  protected readonly tone = (status: ApprovalStatus): string => STATUS_TONE[status] ?? 'muted';

  protected readonly selected = computed(() => this.approvals().find((a) => a.id === this.routeId()));

  protected payloadText(payload: Record<string, unknown> | null): string {
    if (!payload) return '';
    return JSON.stringify(payload, null, 2);
  }

  protected async decide(id: string, decision: ApprovalDecision): Promise<void> {
    await this.approvalsApi.decide(id, { decision, resolution: `Decided ${decision} via Vessa admin` });
    await this.load();
  }

  protected open(id: string): void {
    this.router.navigate(['/approvals', id]);
  }

  protected close(): void {
    this.router.navigate(['/approvals']);
  }
}
