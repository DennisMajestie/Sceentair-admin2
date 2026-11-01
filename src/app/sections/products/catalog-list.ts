import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import { catalogCoverTone, catalogStockTone, CatalogProductRow, CatalogSort } from './catalog-data';
import { saveCatalogCtx } from './prod-shared';

@Component({
  selector: 'app-catalog-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductShot, DecimalPipe],
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
          <th scope="col">On hand</th>
          <th scope="col" [attr.aria-sort]="sortAria('stock')">
            <button type="button" class="catalog-sort-head" (click)="sortChange.emit('stock')">
              Available <app-icon [name]="sortIcon('stock')" [size]="12" aria-hidden="true" />
            </button>
          </th>
          <th scope="col">Reserved</th>
          <th scope="col" [attr.aria-sort]="sortAria('cover')">
            <button type="button" class="catalog-sort-head" (click)="sortChange.emit('cover')">
              Cover <app-icon [name]="sortIcon('cover')" [size]="12" aria-hidden="true" />
            </button>
          </th>
          <th scope="col" [attr.aria-sort]="sortAria('price')">
            <button type="button" class="catalog-sort-head" (click)="sortChange.emit('price')">
              Price <app-icon [name]="sortIcon('price')" [size]="12" aria-hidden="true" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.product.id) {
          <tr>
            <th scope="row">
              <a
                class="table-product-link"
                [routerLink]="['/products/item', row.product.id]"
                [queryParams]="queryParams()"
                (click)="savePagerContext()"
              >
                <span class="table-product-art">
                  <app-product-shot
                    [photo]="row.product.photo"
                    [label]="row.product.name + ' illustration'"
                  />
                </span>
                <span class="table-product-copy">
                  <strong>{{ row.product.name }}</strong>
                  <small>{{ row.product.sku }} · {{ row.product.size }}</small>
                </span>
              </a>
            </th>
            <td>{{ row.product.category }}</td>
            <td class="num">{{ row.onHand | number }}</td>
            <td>
              <span [class]="'table-available is-' + stockTone(row)">
                {{ row.available | number }}
              </span>
            </td>
            <td class="num">{{ row.reserved | number }}</td>
            <td>
              @if (row.coverDays === null) {
                <span class="table-muted">No recent sales</span>
              } @else {
                <span [class]="coverTone(row)">{{ row.coverDays | number: '1.0-0' }} days</span>
              }
            </td>
            <td class="num">{{ money()(row.product.price) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './catalog-list.css',
})
export class CatalogList {
  readonly rows = input.required<readonly CatalogProductRow[]>();
  readonly queryParams = input.required<Record<string, string | null>>();
  readonly catalogIds = input.required<readonly string[]>();
  readonly sort = input.required<CatalogSort>();
  readonly direction = input.required<'asc' | 'desc'>();
  readonly money = input.required<(value: number) => string>();
  readonly sortChange = output<CatalogSort>();

  protected sortAria(sort: CatalogSort): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== sort) return 'none';
    return this.direction() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(sort: CatalogSort): string {
    if (this.sort() !== sort) return 'chevronDown';
    return this.direction() === 'asc' ? 'arrowUp' : 'arrowDown';
  }

  protected stockTone(row: CatalogProductRow): string {
    return catalogStockTone(row);
  }

  protected coverTone(row: CatalogProductRow): string {
    return catalogCoverTone(row);
  }

  protected savePagerContext(): void {
    saveCatalogCtx(this.catalogIds());
  }
}
