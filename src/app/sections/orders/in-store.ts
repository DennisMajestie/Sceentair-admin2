import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { money as fmtMoney } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import {
  CatalogueApiService,
  type ApiProduct,
  type ApiProductVariant,
} from '../../core/catalogue-api.service';
import {
  OrdersApiService,
  type ApiOrder,
  type OfflinePaymentMethod,
} from '../../core/orders-api.service';
import { ToastService } from '../../core/toast';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-orders-in-store',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">Record in-store sale</h1>
        <p class="head__lead">
          A walk-in purchase handed over the counter. The buyer is named on the order and payment is
          captured as cash, POS or bank transfer — all in the same ledger as online sales.
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/orders/all">All orders</a>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center"><app-spinner size="md" label="Loading catalogue" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load the catalogue.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else {
      <section class="card form-panel">
        <h2 class="panel__title">Sale details</h2>
        <form class="sale-form" (ngSubmit)="submit()">
          <div class="cgrid">
            <label class="field">
              <span class="field__label">Product</span>
              <select [(ngModel)]="form.productId" name="product" (ngModelChange)="onProductChange()" required>
                <option value="">Select a product</option>
                @for (product of products(); track product.id) {
                  <option [value]="product.id">{{ product.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span class="field__label">Variant</span>
              <select [(ngModel)]="form.variantId" name="variant" required [disabled]="!form.productId">
                <option value="">Select a variant</option>
                @for (variant of variants(); track variant.id) {
                  <option [value]="variant.id">
                    {{ variant.sku || variant.id.slice(0, 8) }}{{ variant.size ? ' · ' + variant.size : '' }}{{ variant.colour ? ' · ' + variant.colour : '' }}
                  </option>
                }
              </select>
            </label>
          </div>

          <div class="cgrid">
            <label class="field">
              <span class="field__label">Quantity</span>
              <input type="number" min="1" step="1" [(ngModel)]="form.quantity" name="quantity" required />
            </label>
            <label class="field">
              <span class="field__label">Payment method</span>
              <select [(ngModel)]="form.method" name="method">
                <option value="cash">Cash</option>
                <option value="pos">POS terminal</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
          </div>

          <h3 class="dlabel">Buyer</h3>
          <div class="cgrid">
            <label class="field">
              <span class="field__label">Name</span>
              <input type="text" [(ngModel)]="form.buyerName" name="buyerName" placeholder="e.g. Ada Obi" required />
            </label>
            <label class="field">
              <span class="field__label">Phone</span>
              <input type="tel" [(ngModel)]="form.buyerPhone" name="buyerPhone" placeholder="e.g. 08012345678" required />
            </label>
          </div>

          <p class="total">Estimated total {{ money(estimate()) }}</p>
          @if (formError()) { <p class="error" role="alert">{{ formError() }}</p> }
          <button class="btn btn--primary" type="submit" [disabled]="busy() || !form.variantId || !form.buyerName.trim() || !form.buyerPhone.trim() || form.quantity < 1">
            {{ busy() ? 'Recording…' : 'Record sale' }}
          </button>
        </form>
      </section>

      @if (lastSale(); as sale) {
        <section class="card receipt" role="status">
          <h2 class="panel__title">Sale recorded</h2>
          <dl class="facts">
            <div><dt>Order</dt><dd class="mono">{{ sale.orderNumber ?? sale.id }}</dd></div>
            <div><dt>Buyer</dt><dd>{{ sale.guestName }}</dd></div>
            <div><dt>Total</dt><dd>{{ money(sale.totalAmount) }}</dd></div>
            <div><dt>Status</dt><dd>{{ sale.paymentStatus }}</dd></div>
          </dl>
        </section>
      }
    }
  `,
  styles: `
    .form-panel, .receipt { max-width: 860px; margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    .sale-form { display: grid; gap: 14px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field select:disabled { opacity: 0.6; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .total { margin: 0; font-size: var(--fs-lg); font-weight: 700; }
    .error { margin: 0; color: var(--bad); font-size: var(--fs-xs); }
    .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .mono { font-family: var(--fs-mono, monospace); }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 700px) { .cgrid, .facts { grid-template-columns: 1fr; } }
  `,
})
export class OrdersInStore {
  private readonly catalogue = inject(CatalogueApiService);
  private readonly orders = inject(OrdersApiService);
  private readonly toast = inject(ToastService);

  protected readonly money = fmtMoney;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly products = signal<ApiProduct[]>([]);
  protected readonly lastSale = signal<ApiOrder | null>(null);
  protected readonly form = {
    productId: '',
    variantId: '',
    quantity: 1,
    buyerName: '',
    buyerPhone: '',
    method: 'cash' as OfflinePaymentMethod,
  };

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.catalogue.list({ page: 1, limit: 100 });
      this.products.set(result.data ?? []);
    } catch (err) {
      this.products.set([]);
      this.error.set(friendlyErrorMessage(err, 'The catalogue is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected onProductChange(): void {
    this.form.variantId = '';
  }

  protected readonly variants = computed<ApiProductVariant[]>(() => {
    const product = this.products().find((p) => p.id === this.form.productId);
    return product?.variants ?? [];
  });

  private readonly selectedVariant = computed(() =>
    this.variants().find((variant) => variant.id === this.form.variantId) ?? null,
  );

  protected readonly estimate = computed(() => {
    const product = this.products().find((p) => p.id === this.form.productId);
    const variant = this.selectedVariant();
    if (!product || !variant) return 0;
    return (variant.priceOverride ?? product.basePrice) * Math.max(1, this.form.quantity);
  });

  protected async submit(): Promise<void> {
    const quantity = Math.trunc(Number(this.form.quantity));
    if (!this.form.variantId || !Number.isFinite(quantity) || quantity < 1) {
      this.formError.set('Choose a variant and a quantity of at least 1.');
      return;
    }
    if (!this.form.buyerName.trim() || !this.form.buyerPhone.trim()) {
      this.formError.set('Enter the buyer name and phone.');
      return;
    }

    this.busy.set(true);
    this.formError.set(null);
    try {
      const order = await this.orders.create({
        channel: 'in_store',
        source: 'in_store',
        items: [{ variantId: this.form.variantId, quantity }],
        walkIn: {
          name: this.form.buyerName.trim(),
          phone: this.form.buyerPhone.trim(),
        },
      });
      await this.orders.recordPayment(order.id, {
        method: this.form.method,
        amount: order.totalAmount,
      });
      this.lastSale.set(order);
      this.toast.show('In-store sale recorded', 'good');
      this.form.quantity = 1;
      this.form.buyerName = '';
      this.form.buyerPhone = '';
    } catch (err) {
      this.formError.set(friendlyErrorMessage(err, 'The sale could not be recorded.'));
    } finally {
      this.busy.set(false);
    }
  }
}
