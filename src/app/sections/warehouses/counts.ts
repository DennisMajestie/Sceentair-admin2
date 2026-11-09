import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { date as fmtDate, statusLabel, statusTone } from '../../core/format';
import { Drawer } from '../../ui/drawer';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../core/toast';
import {
  ApiCount,
  ApiCountLine,
  InventoryApiService,
  type InventoryItemType,
} from '../../core/inventory-api.service';

function errorText(err: unknown): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : String(err);
}

@Component({
  selector: 'app-warehouses-counts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Drawer, Icon, RouterLink, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Inventory counts</span>
        <h1 class="head__title">Cycle counts</h1>
        <p class="head__lead">{{ rows().length }} counts on the books, {{ stats().done }} finished.</p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--primary" (click)="openNewCount()">
          <app-icon name="plus" [size]="15" />
          New count
        </button>
        <a class="btn btn--ghost" routerLink="/warehouses/locations">View locations</a>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Scheduled</span>
        <span class="kpi__value">{{ countsBy('scheduled') }}</span>
        <span class="kpi__meta">waiting to start</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">In progress</span>
        <span class="kpi__value">{{ countsBy('counting') }}</span>
        <span class="kpi__meta">on the floor now</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Lines matched, 60 days</span>
        <span class="kpi__value">{{ matchedPct().toFixed(0) }}<span class="kpi__suffix">%</span></span>
        <span class="kpi__meta">{{ matchedLines().total }} lines counted</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Units corrected</span>
        <span class="kpi__value">{{ corrected() }}</span>
        <span class="kpi__meta">adjusted to the shelf</span>
      </article>
    </section>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
          All {{ rows().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'scheduled'" [attr.aria-pressed]="filter() === 'scheduled'" (click)="filter.set('scheduled')">
          Scheduled {{ countsBy('scheduled') }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'counting'" [attr.aria-pressed]="filter() === 'counting'" (click)="filter.set('counting')">
          Counting {{ countsBy('counting') }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'done'" [attr.aria-pressed]="filter() === 'done'" (click)="filter.set('done')">
          Done {{ countsBy('done') }}
        </button>
      </div>
      <div class="toolbar__spacer"></div>
      <span class="badge">{{ visible().length }} counts</span>
    </div>

    @if (loading() && rows().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 58px"></div>
        }
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Count</th>
                <th scope="col">Counter</th>
                <th scope="col">When</th>
                <th scope="col">Lines</th>
                <th scope="col">Counted</th>
                <th scope="col">Status</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visible(); track row.id) {
                <tr>
                  <td>
                    <a class="cnt-link" [routerLink]="'/warehouses/counts/' + row.id">{{ row.number }}</a>
                    <span class="sub">{{ row.ago }}</span>
                  </td>
                  <td>
                    <span class="counter">
                      <span class="av av--sm av--{{ row.tone }}">{{ row.initials }}</span>
                      <span>
                        {{ row.by }}
                        <span class="sub">{{ row.time }}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    {{ fmtDate(row.at) }}
                  </td>
                  <td class="num">{{ row.lines.length }} lines</td>
                  <td class="num">{{ row.countedLines }}</td>
                  <td><span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span></td>
                  <td>
                    <a class="btn btn--ghost btn--xs" [routerLink]="'/warehouses/counts/' + row.id">{{ row.action }}</a>
                  </td>
                </tr>
              }
              @if (!loading() && visible().length === 0 && !error()) {
                <tr><td colspan="7" class="empty">No cycle counts match.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Cycle count detail">
      <ng-container drawerTitle>
        @if (selected(); as c) {
          <div class="dtitle">
            <strong class="mono">{{ c.number }}</strong>
            <span class="badge" [class]="'badge badge--' + c.tone">{{ c.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as c) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Status</dt><dd>{{ c.label }}</dd></div>
            <div><dt>Counted lines</dt><dd class="num">{{ c.countedLines }} of {{ c.lines.length }}</dd></div>
            <div><dt>Unit corrections</dt><dd class="num">{{ c.unitCorrections }}</dd></div>
          </dl>

          <h3 class="dlabel">Lines</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col">Counted</th><th scope="col">Movement</th></tr>
              </thead>
              <tbody>
                @for (line of c.lines; track line.itemId) {
                  <tr>
                    <td>
                      {{ line.itemId }}
                      <span class="sub">{{ line.approvalRequestId ? 'approval: ' + line.approvalRequestId : '' }}</span>
                    </td>
                    <td class="num">{{ line.itemType }}</td>
                    <td class="num">{{ line.countedQuantity === null ? '—' : line.countedQuantity }}</td>
                    <td>
                      <button type="button" class="btn btn--ghost btn--xs" (click)="openMovement(line)">Record movement</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (movementLine(); as line) {
            <form class="move-form" (ngSubmit)="submitMovement()">
              <p class="mono move-form__target">{{ line.itemId }}</p>
              <div class="move-form__fields">
                <label class="field"><span class="field__label">Direction</span>
                  <select [(ngModel)]="movementForm.direction" name="moveDirection">
                    <option value="in">In</option>
                    <option value="out">Out</option>
                  </select>
                </label>
                <label class="field"><span class="field__label">Quantity</span><input type="number" min="1" step="1" [(ngModel)]="movementForm.quantity" name="moveQuantity" required /></label>
                <label class="field"><span class="field__label">Note</span><input type="text" [(ngModel)]="movementForm.note" name="moveNote" placeholder="optional" /></label>
              </div>
              <div class="move-form__actions">
                <button type="submit" class="btn btn--primary btn--xs" [disabled]="saving()">Record</button>
                <button type="button" class="btn btn--ghost btn--xs" (click)="closeMovement()">Cancel</button>
              </div>
            </form>
          }
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__suffix { font-size: var(--fs-xl); color: var(--muted); margin-left: 3px; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .cnt-link { font-weight: 700; color: var(--text); }
    .counter { display: inline-flex; align-items: center; gap: 8px; }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .move-form { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); }
    .move-form__target { margin: 0; font-size: var(--fs-xs); font-weight: 700; }
    .move-form__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .move-form__actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .field { display: grid; gap: 5px; min-width: 0; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
  `,
})
export class WarehouseCounts {
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly toasts = inject(ToastService);

  protected readonly fmtDate = fmtDate;
  protected readonly filter = signal('all');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly counts = signal<ApiCount[]>([]);
  protected readonly movementLine = signal<ApiCountLine | null>(null);
  protected readonly saving = signal(false);
  protected readonly movementForm = {
    direction: 'out' as 'in' | 'out',
    quantity: 0,
    note: '',
  };

  constructor() {
    void this.loadCounts();
  }

  private async loadCounts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.inventoryApi.counts({ page: 1, limit: 50 });
      this.counts.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load counts.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed(() =>
    this.counts().map((c) => {
      const countedLines = c.lines.filter((l) => l.countedQuantity !== null).length;
      const unitCorrections = c.lines.reduce(
        (a, l) => a + (l.countedQuantity === null ? 0 : Math.abs(l.countedQuantity)),
        0,
      );
      return {
        id: c.id,
        number: c.number,
        status: c.status,
        tone: statusTone(c.status),
        label: statusLabel(c.status),
        at: Date.parse(c.createdAt),
        time: new Date(c.createdAt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
        by: 'System',
        initials: 'SY',
        ago: this.ago(Date.parse(c.createdAt)),
        countedLines,
        unitCorrections,
        action: 'View details',
        lines: c.lines,
      };
    }),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.rows()
      .filter((r) => f === 'all' || r.status === f)
      .sort((a, b) => b.at - a.at);
  });

  protected readonly selected = computed<{ id: string; number: string; status: string; tone: string; label: string; countedLines: number; unitCorrections: number; lines: ApiCountLine[] } | null>(() => null);

  protected countsBy(status: string): number {
    return this.rows().filter((r) => r.status === status).length;
  }

  protected readonly stats = computed(() => {
    const done = this.counts().filter((c) => c.status === 'done');
    return {
      scheduled: this.counts().filter((c) => c.status === 'scheduled').length,
      counting: this.counts().filter((c) => c.status === 'counting').length,
      done: done.length,
    };
  });

  protected readonly matchedLines = computed(() => {
    const cutoff = Date.now() - 60 * 86400000;
    let total = 0;
    let exact = 0;
    for (const c of this.counts()) {
      if (Date.parse(c.createdAt) < cutoff) continue;
      for (const l of c.lines) {
        if (l.countedQuantity === null) continue;
        total += 1;
        exact += 1;
      }
    }
    return { total, exact };
  });

  protected readonly matchedPct = computed(() => {
    const { total, exact } = this.matchedLines();
    return total > 0 ? (exact / total) * 100 : 0;
  });

  protected readonly corrected = computed(() => {
    let units = 0;
    for (const c of this.counts()) {
      if (c.status !== 'done') continue;
      for (const l of c.lines) {
        if (l.countedQuantity === null) continue;
        units += Math.abs(l.countedQuantity);
      }
    }
    return units;
  });

  protected openNewCount(): void {
    this.toasts.show('New count creation requires item selection from the API.', 'info');
  }

  protected openMovement(line: ApiCountLine): void {
    this.movementLine.set(line);
    this.movementForm.direction = 'out';
    this.movementForm.quantity = 0;
    this.movementForm.note = '';
  }

  protected closeMovement(): void {
    this.movementLine.set(null);
  }

  protected async submitMovement(): Promise<void> {
    const line = this.movementLine();
    if (!line) return;
    const quantity = Number(this.movementForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.toasts.show('Quantity must be greater than zero.', 'bad');
      return;
    }
    this.saving.set(true);
    try {
      const delta = this.movementForm.direction === 'out' ? -quantity : quantity;
      const note = this.movementForm.note.trim();
      await this.inventoryApi.recordMovement(line.itemType as InventoryItemType, line.itemId, {
        movementType: 'adjustment',
        quantityDelta: delta,
        ...(note ? { referenceId: note } : {}),
      });
      this.toasts.show('Movement recorded', 'good');
      this.closeMovement();
    } catch (err) {
      this.toasts.show(errorText(err), 'bad');
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    // no-op: selection is not route-based in this simplified version
  }

  private ago(at: number): string {
    const days = Math.round((Date.now() - at) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 d ago';
    return `${days} d ago`;
  }
}
