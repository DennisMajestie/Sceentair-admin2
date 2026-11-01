import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import type { CatalogRow } from './catalog';
import { saveCatalogCtx } from './prod-shared';

type CatalogApiSort = 'name' | 'price';

function variantSku(row: CatalogRow): string {
  return row.variants[0]?.sku ?? '—';
}

function variantSize(row: CatalogRow): string {
  return row.variants[0]?.size ?? '—';
}

@Component({
  selector: 'app-catalog-api-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductShot],
  template: `
    <table class="catalog-table">
      <thead>
        <tr>
          <th scope="col" [attr.aria-sort]="sortAria('name')">
            <button type="button" class="catalog-sort-head" (click)="sortChange.emit('name')">
              Product <app-icon [name]="sortIcon('name')" [size]="12" aria-hidden="true" />
            </button>
          </th>
          <th scope="col">Category</th>
          <th scope="col" [attr.aria-sort]="sortAria('price')">
            <button type="button" class="catalog-sort-head" (click)="sortChange.emit('price')">
              Price <app-icon [name]="sortIcon('price')" [size]="12" aria-hidden="true" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr>
            <th scope="row">
              <a
                class="table-product-link"
                [routerLink]="['/products/item', row.id]"
                [queryParams]="queryParams()"
                (click)="savePagerContext()"
              >
                <span class="table-product-art">
                  <app-product-shot [photo]="row.photo ?? ''" [label]="row.name" />
                </span>
                <span class="table-product-copy">
                  <strong>{{ row.name }}</strong>
                  <small>{{ variantSku(row) }} · {{ variantSize(row) }}</small>
                </span>
              </a>
            </th>
            <td>{{ row.category ?? '—' }}</td>
            <td class="num">{{ money()(row.price) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './catalog-list.css',
})
export class CatalogApiProductList {
  readonly rows = input.required<readonly CatalogRow[]>();
  readonly queryParams = input.required<Record<string, string | null>>();
  readonly catalogIds = input.required<readonly string[]>();
  readonly sort = input.required<CatalogApiSort>();
  readonly direction = input.required<'asc' | 'desc'>();
  readonly money = input.required<(value: number) => string>();
  readonly sortChange = output<CatalogApiSort>();

  protected variantSize = variantSize;
  protected variantSku = variantSku;

  protected sortAria(sort: CatalogApiSort): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== sort) return 'none';
    return this.direction() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(sort: CatalogApiSort): string {
    if (this.sort() !== sort) return 'chevronDown';
    return this.direction() === 'asc' ? 'arrowUp' : 'arrowDown';
  }

  protected savePagerContext(): void {
    saveCatalogCtx(this.catalogIds());
  }
}
