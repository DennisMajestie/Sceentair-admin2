import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductShot } from '../../ui/product-shot';
import {
  catalogCoverPercent,
  catalogCoverTone,
  catalogLocationColor,
  catalogStockLabel,
  CatalogProductRow,
} from './catalog-data';
import { saveCatalogCtx } from './prod-shared';

@Component({
  selector: 'app-catalog-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductShot, DecimalPipe],
  template: `
    <article class="product-card">
      <a
        class="product-card__link"
        [routerLink]="['/products/item', row().product.id]"
        [queryParams]="queryParams()"
        (click)="savePagerContext()"
        [attr.aria-label]="productLinkLabel()"
      >
        <div class="product-card__art">
          <app-product-shot
            [photo]="row().product.photo"
            [label]="row().product.name + ' ' + row().product.size + ' illustration'"
          />
          <span class="product-card__art-label">Concept illustration</span>
          <span
            class="product-status"
            [class.is-good]="!row().low"
            [class.is-warn]="row().low && !row().out"
            [class.is-bad]="row().out"
          >
            {{ stockLabel() }}
          </span>
          @if (!row().product.active) {
            <span class="product-card__inactive">Inactive</span>
          }
        </div>

        <div class="product-card__identity">
          <div class="product-card__title-row">
            <div>
              <p class="product-card__category">{{ row().product.category }}</p>
              <h2 class="product-card__name">{{ row().product.name }}</h2>
            </div>
            <span class="product-card__size">{{ row().product.size }}</span>
          </div>
          <p class="product-card__sku mono">{{ row().product.sku }}</p>
          <p class="product-card__blurb">{{ row().product.blurb }}</p>
        </div>

        <div class="product-card__price-row">
          <span class="product-card__price">{{ money()(row().product.price) }}</span>
          <span class="product-card__price-caption">retail · demo</span>
        </div>

        <div class="product-stock">
          <div class="product-stock__heading">
            <span>Stock by location</span>
            <span>{{ row().onHand | number }} on hand</span>
          </div>
          @for (location of row().locations; track location.id; let i = $index) {
            <div class="location-stock">
              <div class="location-stock__line">
                <span>{{ location.name }}</span>
                <span class="num">{{ location.units | number }}</span>
              </div>
              <div class="location-stock__track">
                <span
                  class="location-stock__fill"
                  [style.--bar-color]="locationColor(i)"
                  [style.--share]="location.share"
                  [attr.data-share]="location.share"
                ></span>
              </div>
            </div>
          }
        </div>

        <div class="product-card__footer">
          <span class="product-card__available">
            <strong>{{ row().available | number }}</strong> available
          </span>
          <span class="product-card__reserved">{{ row().reserved | number }} reserved</span>
        </div>
        <div class="cover-summary">
          <span class="cover-summary__label">30-day cover</span>
          @if (row().coverDays === null) {
            <span class="cover-summary__value is-muted">No recent sales</span>
          } @else {
            <span
              class="cover-summary__value"
              [class.is-low]="coverTone() === 'is-low'"
              [class.is-watch]="coverTone() === 'is-watch'"
              [class.is-healthy]="coverTone() === 'is-healthy'"
            >
              {{ row().coverDays | number: '1.0-0' }} days
            </span>
            <span class="cover-track">
              <span
                class="cover-track__fill"
                [class.is-watch]="coverTone() === 'is-watch'"
                [class.is-low]="coverTone() === 'is-low'"
                [style.--cover]="coverPercent()"
                [attr.data-cover]="coverPercent()"
              ></span>
            </span>
          }
        </div>
      </a>
    </article>
  `,
  styleUrl: './catalog-product-card.css',
})
export class CatalogProductCard {
  readonly row = input.required<CatalogProductRow>();
  readonly queryParams = input.required<Record<string, string | null>>();
  readonly catalogIds = input.required<readonly string[]>();
  readonly money = input.required<(value: number) => string>();

  protected stockLabel(): string {
    return catalogStockLabel(this.row());
  }

  protected coverTone(): string {
    return catalogCoverTone(this.row());
  }

  protected coverPercent(): number {
    return catalogCoverPercent(this.row());
  }

  protected locationColor(index: number): string {
    return catalogLocationColor(index);
  }

  protected productLinkLabel(): string {
    const row = this.row();
    return `${row.product.name}, ${row.product.size}, SKU ${row.product.sku}, ${this.stockLabel()}. Open product details.`;
  }

  protected savePagerContext(): void {
    saveCatalogCtx(this.catalogIds());
  }
}
