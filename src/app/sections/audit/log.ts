import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuditApiService, type ApiAuditEntry, type ApiAuditVerify } from '../../core/audit-api.service';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { date as fmtDate } from '../../core/format';

interface AuditRow {
  id: string;
  at: number;
  who: string;
  whoName: string;
  action: string;
  text: string;
  href: string;
  beforeState: unknown;
  afterState: unknown;
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
            <span class="mono audit-card__id">{{ row.id }}</span>
            <span class="audit-card__at">{{ date(row.at) }}</span>
          </span>
          <span class="audit-card__actor">
            <span>{{ row.whoName }}</span>
            <span class="audit-card__action">{{ row.action }}</span>
          </span>
          <span class="audit-card__text">
            {{ row.text ?? '—' }}
          </span>
          <span class="audit-card__href">
            {{ row.href ?? '—' }}
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
            <strong class="mono">{{ e.id }}</strong>
            <span>{{ e.action }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as e) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Action</dt><dd>{{ e.action }}</dd></div>
            <div><dt>Actor</dt><dd>{{ e.whoName }}</dd></div>
            <div><dt>At</dt><dd>{{ date(e.at) }}</dd></div>
            <div><dt>Href</dt><dd>{{ e.href ?? '—' }}</dd></div>
          </dl>

          <h3 class="dlabel">Before state</h3>
          <pre class="dpayload">{{ payloadText(e.beforeState) }}</pre>

          <h3 class="dlabel">After state</h3>
          <pre class="dpayload">{{ payloadText(e.afterState) }}</pre>
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
    .audit-card__actor { gap: 10px; }
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
      entriesResult.data.map((e) => ({
        id: e.id,
        at: Date.parse(e.timestamp) || 0,
        who: e.actorId ?? 'system',
        whoName: e.actorId ?? 'system',
        action: e.action,
        text: '',
        href: '',
        beforeState: e.beforeState,
        afterState: e.afterState,
      })),
    );
    this.chain.set(chain);
  }

  protected readonly visible = computed(() => {
    const list = this.entries();
    const q = this.query().trim().toLowerCase();
    return list
      .filter((e) => {
        if (!q) return true;
        const haystack = `${e.whoName} ${e.action} ${e.text}`.toLowerCase();
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
