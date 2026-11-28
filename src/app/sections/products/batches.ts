import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { date as fmtDate, daysUntil, money as fmtMoney, statusLabel, statusTone } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { ProductShot } from '../../ui/product-shot';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-products-batches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Drawer, ProductShot, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Products</span>
        <h1 class="head__title">Batches</h1>
        <p class="head__lead">Lot tracking, shelf life and QA holds across the catalogue.</p>
      </div>
      <div class="head__actions">
        <span class="badge badge--warn">{{ stats().onHold }} on hold</span>
        <span class="badge badge--bad">{{ stats().inQa }} in QA</span>
        <span class="badge">{{ stats().expiringSoon }} expiring soon</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Batch status filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" (click)="filter.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search lot or product" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
    </div>

    @if (store.loading()) {
      <div class="load-center" role="status"><app-spinner size="md" label="Loading batches" /></div>
    }

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Lot</th>
              <th scope="col">Product</th>
              <th scope="col">Location</th>
              <th scope="col">Made</th>
              <th scope="col">Expires</th>
              <th scope="col">Left</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr class="clickable" (click)="open(row.id)">
                <td class="mono strong">{{ row.lot }}</td>
                <td>
                  {{ row.product }}
                  <span class="sub mono">{{ row.sku }}</span>
                </td>
                <td>{{ row.location }}</td>
                <td>{{ date(row.madeAt) }}</td>
                <td>
                  @if (row.expiresAt) {
                    <span [class.expiring]="(row.daysLeft ?? 0) <= 90">{{ date(row.expiresAt) }}</span>
                    <span class="sub">{{ row.daysLeft }}d left</span>
                  } @else {
                    <span class="sub">Not tracked</span>
                  }
                </td>
                <td class="num">{{ row.left }}/{{ row.qty }}</td>
                <td><span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span></td>
              </tr>
            }
            @if (!store.loading() && visible().length === 0) {
              <tr><td colspan="7" class="empty">No batches match.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Batch detail">
      <ng-container drawerTitle>
        @if (selected(); as b) {
          <div class="dtitle">
            <strong>{{ b.lot }}</strong>
            <span class="badge" [class]="'badge badge--' + b.tone">{{ b.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as b) {
        <div class="dbody">
          <div class="dsummary">
            <app-product-shot class="shot" [photo]="b.photo" [label]="b.product" />
            <div class="dsummary__text">
              <strong>{{ b.product }} {{ b.size }}</strong>
              <span class="dmeta">{{ b.sku }} · {{ b.location }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Remaining</span>
              <strong class="dtotal">{{ b.left }}<small>/{{ b.qty }}</small></strong>
            </div>
          </div>

          @if (b.status !== 'released') {
            <div class="notice" role="status">
              <app-icon name="alert" [size]="14" />
              <span>{{ b.status === 'quarantine' ? 'This lot is quarantined pending QA release.' : 'This lot is on hold.' }}</span>
            </div>
          }

          <h3 class="dlabel">Batch details</h3>
          <dl class="facts">
            <div><dt>SKU</dt><dd class="mono">{{ b.sku }}</dd></div>
            <div><dt>Location</dt><dd>{{ b.location }}</dd></div>
            <div><dt>Made</dt><dd>{{ date(b.madeAt) }}</dd></div>
            <div><dt>Expires</dt><dd>{{ b.expiresAt ? date(b.expiresAt) : 'Not tracked' }}</dd></div>
            <div><dt>Produced</dt><dd class="num">{{ b.qty }}</dd></div>
            <div><dt>Remaining</dt><dd class="num">{{ b.left }}</dd></div>
            <div><dt>Chemist</dt><dd>{{ b.chemist }}</dd></div>
            <div><dt>Value at cost</dt><dd class="num">{{ money(b.value) }}</dd></div>
          </dl>

          <div class="dfoot">{{ b.share }}% of total product stock</div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .clickable {
      cursor: pointer;
    }
    .strong {
      font-weight: 700;
    }
    .sub {
      display: block;
      font-size: var(--fs-2xs);
      color: var(--faint);
    }
    .expiring {
      color: var(--warn);
      font-weight: 600;
    }
    .shot {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      overflow: hidden;
      flex: none;
    }
    .dsummary__text {
      display: grid;
      gap: 3px;
      flex: 1;
      min-width: 0;
    }
    .dsummary__text strong {
      font-size: var(--fs-md);
      line-height: 1.3;
    }
    .notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--well);
      color: var(--muted);
      font-size: var(--fs-xs);
    }
    .notice app-icon { color: var(--primary); }
    .dfoot {
      font-size: var(--fs-sm);
      color: var(--muted);
    }
  `,
})
export class ProductBatches {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'released', label: 'Released' },
    { id: 'hold', label: 'On hold' },
    { id: 'quarantine', label: 'Quarantine' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly stats = computed(() => this.store.batchStats());

  private readonly rows = computed(() =>
    this.store.batches().map((b) => {
      const p = this.store.product(b.productId);
      const total = p ? Object.values(p.stock).reduce((a, x) => a + x, 0) : 0;
      const share = total > 0 ? Math.round((b.left / total) * 100) : 0;
      return {
        id: b.id,
        lot: b.lot,
        product: p?.name ?? b.productId,
        size: p?.size ?? '',
        sku: p?.sku ?? '',
        photo: (p?.photo ?? 'serum') as 'balm' | 'oil' | 'serum' | 'fluid' | 'gel' | 'duo',
        location: this.store.location(b.locId)?.name ?? b.locId,
        madeAt: b.madeAt,
        expiresAt: b.expiresAt,
        daysLeft: b.expiresAt ? daysUntil(b.expiresAt) : null,
        qty: b.qty,
        left: b.left,
        status: b.status,
        tone: statusTone(b.status),
        label: statusLabel(b.status),
        chemist: this.store.teammate(b.chemistId)?.name ?? b.chemistId,
        value: b.left * (p?.cost ?? 0),
        share,
      };
    }),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (f !== 'all' && r.status !== f) return false;
      if (!q) return true;
      return `${r.lot} ${r.product} ${r.sku}`.toLowerCase().includes(q);
    });
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/products/batches', id]);
  }

  protected close(): void {
    this.router.navigate(['/products/batches']);
  }
}
