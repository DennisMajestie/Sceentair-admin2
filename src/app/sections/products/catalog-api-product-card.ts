import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductShot } from '../../ui/product-shot';
import type { CatalogRow } from './catalog';
import { saveCatalogCtx } from './prod-shared';

function variantSku(row: CatalogRow): string {
  return row.variants[0]?.sku ?? '—';
}

function variantSize(row: CatalogRow): string {
  return row.variants[0]?.size ?? '—';
}

@Component({
  selector: 'app-catalog-api-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductShot],
  template: `
    <article class="product-card">
      <a
        class="product-card__link"
        [routerLink]="['/products/item', row().id]"
        [queryParams]="queryParams()"
        (click)="savePagerContext()"
        [attr.aria-label]="productLinkLabel()"
      >
        <div class="product-card__art">
          <app-product-shot [photo]="row().photo ?? ''" [label]="row().name" />
          <span class="product-card__art-label">API product</span>
          @if (row().isBestseller) {
            <span class="product-badge is-good">Bestseller</span>
          }
        </div>

        <div class="product-card__identity">
          <div class="product-card__title-row">
            <div>
              @if (row().category) {
                <p class="product-card__category">{{ row().category }}</p>
              }
              <h2 class="product-card__name">{{ row().name }}</h2>
            </div>
            <span class="product-card__size">{{ variantSize(row()) }}</span>
          </div>
          <p class="product-card__sku mono">SKU {{ variantSku(row()) }}</p>
        </div>

        <div class="product-card__price-row">
          <span class="product-card__price">{{ money()(row().price) }}</span>
          <span class="product-card__price-caption">retail</span>
          <span class="product-card__sold">{{ row().soldCount }} buyers</span>
        </div>

        <div class="product-card__footer">
          <span class="product-card__available">Stock by location not exposed by the public catalogue.</span>
        </div>
      </a>
    </article>
  `,
  styleUrl: './catalog-product-card.css',
})
export class CatalogApiProductCard {
  readonly row = input.required<CatalogRow>();
  readonly queryParams = input.required<Record<string, string | null>>();
  readonly catalogIds = input.required<readonly string[]>();
  readonly money = input.required<(value: number) => string>();

  protected variantSize = variantSize;
  protected variantSku = variantSku;

  protected productLinkLabel(): string {
    const row = this.row();
    return `${row.name}, SKU ${variantSku(row)}, ${row.price} · Open product details.`;
  }

  protected savePagerContext(): void {
    saveCatalogCtx(this.catalogIds());
  }
}
