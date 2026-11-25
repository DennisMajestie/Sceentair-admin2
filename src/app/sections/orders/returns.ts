import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { date as fmtDate, money as fmtMoney, statusLabel, statusTone } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { ProductShot } from '../../ui/product-shot';
import { ReturnsApiService, type ResolveReturnInput } from '../../core/returns-api.service';

type ReturnStatus = 'requested' | 'received' | 'restocked' | 'refunded' | 'rejected';

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Requested',
  received: 'Received',
  restocked: 'Restocked',
  refunded: 'Refunded',
  rejected: 'Rejected',
};

@Component({
  selector: 'app-orders-returns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Drawer, ProductShot, RouterLink, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">Returns</h1>
        <p class="head__lead">{{ store.returns().length }} returns logged · {{ pending() }} awaiting a decision.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Return status filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="filter.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">RMA</th>
              <th scope="col">Order</th>
              <th scope="col">Product</th>
              <th scope="col">Qty</th>
              <th scope="col">Reason</th>
              <th scope="col">Refund</th>
              <th scope="col">Raised</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr>
                <td class="mono strong"><a class="return-link" [routerLink]="'/orders/returns/' + row.id">{{ row.number }}</a></td>
                <td class="mono">{{ row.orderNumber }}</td>
                <td>{{ row.product }}</td>
                <td class="num">{{ row.qty }}</td>
                <td>{{ row.reason }}</td>
                <td class="num">{{ money(row.refund) }}</td>
                <td>{{ date(row.createdAt) }}</td>
                <td><span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span></td>
              </tr>
            }
            @if (visible().length === 0) {
              <tr><td colspan="8" class="empty">No returns match.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Return detail">
      <ng-container drawerTitle>
        @if (selected(); as r) {
          <div class="dtitle">
            <strong class="mono">{{ r.number }}</strong>
            <span class="badge" [class]="'badge badge--' + r.tone">{{ r.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as r) {
        <div class="dbody">
          <div class="row dgap">
            <span class="thumb thumb--lg"><app-product-shot [photo]="r.photo" [label]="r.product" /></span>
            <div>
              <h3 class="dproduct">{{ r.product }}</h3>
              <p class="dsub">{{ r.size }} · {{ r.sku }}</p>
              <p class="dsub">Order <span class="mono">{{ r.orderNumber }}</span></p>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Quantity</dt><dd class="num">{{ r.qty }}</dd></div>
            <div><dt>Refund</dt><dd class="num">{{ money(r.refund) }}</dd></div>
            <div><dt>Raised</dt><dd>{{ date(r.createdAt) }}</dd></div>
            <div><dt>Reason</dt><dd>{{ r.reason }}</dd></div>
            <div><dt>Tracking</dt><dd>{{ r.trackingNumber ?? '—' }}</dd></div>
            <div><dt>Bay tag</dt><dd>{{ r.bayTag ?? '—' }}</dd></div>
            <div><dt>Return by</dt><dd>{{ r.returnDeadline ? date(r.returnDeadline) : '—' }}</dd></div>
          </dl>

          @if (r.overdue) {
            <p class="return-overdue" role="status">Past the 24-hour completion window — contact the customer before resolving.</p>
          } @else {
            <p class="return-window">Returns must be requested within 12 hours of delivery and completed within 24 hours of the request.</p>
          }

          <div class="dmeta">{{ r.customer }}</div>

          @if (r.photoUrls.length > 0) {
            <div class="photo-links">
              <span class="dlabel">Photos</span>
              @for (url of r.photoUrls; track url) {
                <a [href]="url" target="_blank" rel="noopener">Photo {{ $index + 1 }}</a>
              }
            </div>
          }

          @if (r.status === 'requested') {
            <h3 class="dlabel">Resolve return</h3>
            <div class="resolve-form">
              <label class="resolve-label">
                <span>Decision</span>
                <select class="resolve-select" [(ngModel)]="resolveDecision">
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label class="resolve-label">
                <span>Resolution notes</span>
                <textarea class="resolve-textarea" [(ngModel)]="resolveResolution" placeholder="e.g. Inspected and restocked"></textarea>
              </label>
              <label class="resolve-label">
                <span>Restocked</span>
                <input type="checkbox" class="resolve-checkbox" [(ngModel)]="resolveRestocked" />
              </label>
              <label class="resolve-label">
                <span>Damaged</span>
                <input type="checkbox" class="resolve-checkbox" [(ngModel)]="resolveDamaged" />
              </label>
              <label class="resolve-label">
                <span>Tracking number</span>
                <input type="text" class="resolve-input" [(ngModel)]="resolveTrackingNumber" placeholder="e.g. TRK123456" />
              </label>
              <label class="resolve-label">
                <span>Bay tag</span>
                <input type="text" class="resolve-input" [(ngModel)]="resolveBayTag" placeholder="e.g. BAY-001" />
              </label>
              <label class="resolve-label">
                <span>Photo links (comma separated)</span>
                <input type="text" class="resolve-input" [(ngModel)]="resolvePhotos" placeholder="e.g. https://…/front.jpg, https://…/tag.jpg" />
              </label>
              <div class="resolve-actions">
                <button type="button" class="btn btn--ghost" (click)="clearResolve()">Clear</button>
                <button type="button" class="btn" [disabled]="!resolveResolution()?.trim()" (click)="submitResolve(r.id)">Submit decision</button>
              </div>
              @if (resolveError()) {
                <p class="resolve-error">{{ resolveError() }}</p>
              }
            </div>
          }
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .photo-links { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 12px 0; }
    .photo-links a { font-size: var(--fs-sm); color: var(--primary); }
    .return-overdue { font-size: var(--fs-xs); color: var(--bad); font-weight: 700; }
    .return-window { font-size: var(--fs-xs); color: var(--muted); }
    .return-link { color: inherit; text-decoration: none; }
    .return-link:hover { color: var(--primary); text-decoration: underline; }
    .strong { font-weight: 700; }
    .dproduct { font-size: var(--fs-xl); font-weight: 700; }
    .dsub { font-size: var(--fs-sm); color: var(--muted); }
    .dgap { align-items: flex-start; gap: 14px; }
    .resolve-form { display: grid; gap: 10px; margin-top: 12px; }
    .resolve-label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-xs); color: var(--faint); font-weight: 600; }
    .resolve-select, .resolve-textarea, .resolve-input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); color: var(--text); font-size: var(--fs-sm); }
    .resolve-textarea { min-height: 80px; resize: vertical; }
    .resolve-checkbox { width: 16px; height: 16px; }
    .resolve-actions { display: flex; gap: 8px; margin-top: 8px; }
    .resolve-error { color: var(--bad); font-size: var(--fs-xs); margin-top: 8px; }
    @media (max-width: 700px) { .resolve-actions { flex-direction: column; } }
  `,
})
export class OrdersReturns {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly returnsApi = inject(ReturnsApiService);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly filter = signal('all');
  protected readonly resolveDecision = signal<'resolved' | 'rejected'>('resolved');
  protected readonly resolveResolution = signal('');
  protected readonly resolveRestocked = signal(false);
  protected readonly resolveDamaged = signal(false);
  protected readonly resolveTrackingNumber = signal('');
  protected readonly resolveBayTag = signal('');
  protected readonly resolvePhotos = signal('');
  protected readonly resolveError = signal<string | null>(null);
  protected readonly resolveLoading = signal(false);

  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'requested', label: 'Requested' },
    { id: 'received', label: 'Received' },
    { id: 'restocked', label: 'Restocked' },
    { id: 'refunded', label: 'Refunded' },
    { id: 'rejected', label: 'Rejected' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  private readonly rows = computed(() =>
    this.store.returns().map((r) => {
      const p = this.store.product(r.productId);
      const o = this.store.order(r.orderId);
      return {
        id: r.id,
        number: r.number,
        orderNumber: o?.number ?? r.orderId,
        product: (p ?? this.store.productForVariant(r.productId))?.name ?? r.productId,
        size: p?.size ?? '',
        sku: p?.sku ?? '',
        photo: (p?.photo ?? 'serum') as 'balm' | 'oil' | 'serum' | 'fluid' | 'gel' | 'duo',
        qty: r.qty,
        reason: r.reason,
        status: r.status,
        tone: statusTone(r.status),
        label: statusLabel(r.status),
        refund: r.refund,
        createdAt: r.createdAt,
        returnDeadline: r.returnDeadline,
        overdue: r.status === 'requested' && r.returnDeadline > 0 && Date.now() > r.returnDeadline,
        customer: this.store.customer(o?.customerId ?? '')?.name ?? '',
        trackingNumber: r.trackingNumber,
        bayTag: r.bayTag,
        photoUrls: r.photoUrls ?? [],
      };
    }),
  );

  protected readonly pending = computed(
    () => this.store.returns().filter((r) => r.status === 'requested').length,
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.rows()
      .filter((r) => f === 'all' || r.status === f)
      .sort((a, b) => b.createdAt - a.createdAt);
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()));

  protected close(): void {
    this.router.navigate(['/orders/returns']);
  }

  public async load(): Promise<void> {
    // Returns are loaded via store.load(); no separate refresh endpoint exposed.
  }

  protected clearResolve(): void {
    this.resolveDecision.set('resolved');
    this.resolveResolution.set('');
    this.resolveRestocked.set(false);
    this.resolveDamaged.set(false);
    this.resolveTrackingNumber.set('');
    this.resolveBayTag.set('');
    this.resolvePhotos.set('');
    this.resolveError.set(null);
  }

  protected async submitResolve(id: string): Promise<void> {
    this.resolveError.set(null);
    this.resolveLoading.set(true);
    try {
      const input: ResolveReturnInput = {
        decision: this.resolveDecision(),
        resolution: this.resolveResolution(),
        restocked: this.resolveRestocked(),
        damaged: this.resolveDamaged(),
        trackingNumber: this.resolveTrackingNumber() || undefined,
        bayTag: this.resolveBayTag() || undefined,
        photoUrls: this.resolvePhotos()
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean),
      };
      await this.store.resolveReturn(id, input);
      this.close();
    } catch (err) {
      this.resolveError.set(err instanceof Error ? err.message : 'Resolve failed. Please try again.');
    } finally {
      this.resolveLoading.set(false);
    }
  }
}