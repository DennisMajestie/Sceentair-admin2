import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateFull, monthYear, titleCase } from '../../core/format';
import { moneyNgn } from './cs-data';
import type { CustomerDetailData } from '../../core/customer-detail';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import { SdDetailDrawerComponent } from '../../ui/sd-detail-drawer';

@Component({
  selector: 'sd-customer-detail-drawer',
  standalone: true,
  imports: [RouterLink, Icon, ProductShot, SdDetailDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-detail-drawer
      [open]="open()"
      [labelledBy]="'sd-customer-title'"
      [showFooter]="hasEmail()"
      (close)="close.emit()"
    >
      <div sdDrawerHeader>
        @if (account(); as detail) {
          <div class="sd-customer-heading">
            <span class="sd-customer-avatar av--{{ detail.tone }}" aria-hidden="true">{{ detail.initials }}</span>
            <div class="sd-customer-heading__text">
              <h2 id="sd-customer-title">{{ detail.customer.name }}</h2>
              @if (detail.contactLine) {
                <p>{{ detail.contactLine }}</p>
              }
            </div>
          </div>
        } @else {
          <div class="sd-customer-heading">
            <span class="sd-customer-avatar av--slate" aria-hidden="true">?</span>
            <div class="sd-customer-heading__text">
              <h2 id="sd-customer-title">Customer not found</h2>
            </div>
          </div>
        }
      </div>

      <div sdDrawerContent>
        @if (account(); as detail) {
          <div class="sd-customer-content">
            @if (detail.customer.tags.length || detail.customer.since) {
              <div class="sd-customer-chips">
                @for (tag of detail.customer.tags; track tag) {
                  <span class="cs-tag" [attr.data-tone]="tag">{{ tagLabel(tag) }}</span>
                }
                @if (detail.customer.since) {
                  <span class="sd-customer-chip">Since {{ monthYear(detail.customer.since) }}</span>
                }
              </div>
            }

            <div class="sd-contact-grid">
              @if (detail.customer.email) {
                <a class="sd-contact-tile sd-contact-tile--wide" [href]="'mailto:' + detail.customer.email">
                  <span class="sd-contact-icon"><app-icon name="mail" [size]="16" /></span>
                  <span class="sd-contact-copy"><small>Email</small><strong>{{ detail.customer.email }}</strong></span>
                </a>
              }
              @if (detail.customer.phone) {
                <a class="sd-contact-tile" [href]="'tel:' + detail.customer.phone">
                  <span class="sd-contact-icon"><app-icon name="phone" [size]="16" /></span>
                  <span class="sd-contact-copy"><small>Phone</small><strong>{{ detail.customer.phone }}</strong></span>
                </a>
              }
              @if (detail.location) {
                <div class="sd-contact-tile">
                  <span class="sd-contact-icon"><app-icon name="map-pin" [size]="16" /></span>
                  <span class="sd-contact-copy"><small>Ships to</small><strong>{{ detail.location }}</strong></span>
                </div>
              }
            </div>

            <div class="sd-customer-stats">
              <article class="sd-customer-stat">
                <small>Orders</small>
                <strong>{{ detail.orderCount }}</strong>
                <span>{{ detail.cancelledCount ? detail.cancelledCount + ' cancelled' : 'none cancelled' }}</span>
              </article>
              <article class="sd-customer-stat">
                <small>Revenue</small>
                <strong>{{ money(detail.revenue) }}</strong>
                @if (detail.unpaid > 0) {
                  <span>{{ money(detail.unpaid) }} unpaid</span>
                }
              </article>
              @if (detail.averageOrder !== null) {
                <article class="sd-customer-stat">
                  <small>Average order</small>
                  <strong>{{ money(detail.averageOrder) }}</strong>
                  @if (detail.hasWholesalePricing) {
                    <span>Wholesale prices</span>
                  }
                </article>
              }
              @if (detail.lastOrder; as last) {
                <article class="sd-customer-stat">
                  <small>Last order</small>
                  <strong>{{ last.primary }}</strong>
                  <span>{{ last.full }}</span>
                </article>
              }
            </div>

            @if (detail.orderCount > 0) {
              <section class="sd-customer-section" aria-labelledby="sd-monthly-title">
                <h3 id="sd-monthly-title">Monthly spend</h3>
                <div class="sd-months">
                  @for (month of detail.monthly; track month.label; let last = $last) {
                    <div class="sd-month" tabindex="0" role="img" [attr.aria-label]="month.label + ': ' + money(month.value)">
                      <div class="sd-month__track">
                        <div class="sd-month__fill" [class.sd-month__fill--current]="last" [style.height.%]="month.percent"></div>
                      </div>
                      <span>{{ month.label }}</span>
                    </div>
                  }
                </div>
              </section>
            }

            @if (detail.recentOrders.length) {
              <section class="sd-customer-section" aria-labelledby="sd-orders-title">
                <h3 id="sd-orders-title">Orders</h3>
                <div class="sd-order-list">
                  @for (order of detail.recentOrders; track order.id) {
                    <a class="sd-order-row" [routerLink]="['/orders/all', order.id]">
                      <span class="sd-order-main">
                        <strong>{{ order.number }}</strong>
                        <small>{{ dateFull(order.createdAt) }} · {{ order.units }} units</small>
                      </span>
                      <span class="sd-order-end">
                        <span class="badge badge--{{ order.statusTone }}">{{ order.statusLabel }}</span>
                        <strong>{{ money(order.total) }}</strong>
                      </span>
                    </a>
                  }
                </div>
              </section>
            }

            @if (detail.mostBought.length) {
              <section class="sd-customer-section" aria-labelledby="sd-products-title">
                <h3 id="sd-products-title">Buys most</h3>
                <div class="sd-bought">
                  @for (product of detail.mostBought; track product.id) {
                    <a class="sd-bought-item" [routerLink]="['/products/item', product.id]" [attr.aria-label]="product.name + ', ' + product.quantity + ' units purchased'">
                      <span class="sd-bought-image"><app-product-shot [photo]="product.photo" [label]="product.name" /></span>
                      <span>{{ product.name }}</span>
                    </a>
                  }
                </div>
              </section>
            }
          </div>
        } @else {
          <p class="sd-customer-not-found">This customer could not be found.</p>
        }
      </div>

      @if (account(); as detail) {
        @if (detail.customer.email; as email) {
          <div sdDrawerFooter class="sd-customer-footer">
            <a class="btn btn--ghost" [href]="'mailto:' + email">
              <app-icon name="mail" [size]="16" />
              {{ detail.firstName ? 'Email ' + detail.firstName : 'Email' }}
            </a>
          </div>
        }
      }
    </sd-detail-drawer>
  `,
  styleUrl: './customer-detail-drawer.css',
})
export class CustomerDetailDrawerComponent {
  readonly open = input(false);
  readonly account = input<CustomerDetailData | null>(null);
  readonly close = output<void>();
  protected readonly money = moneyNgn;
  protected readonly monthYear = monthYear;
  protected readonly dateFull = dateFull;

  protected hasEmail(): boolean {
    return !!this.account()?.customer.email;
  }

  protected tagLabel(tag: string): string {
    if (tag === 'vip') return 'VIP';
    if (tag === 'net30') return 'Net 30';
    if (tag === 'subscriber') return 'Subscriber';
    return titleCase(tag);
  }
}
