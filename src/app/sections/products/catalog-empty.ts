import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'app-catalog-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="catalog-empty">
      <span class="catalog-empty__icon">
        <app-icon name="search" [size]="21" aria-hidden="true" />
      </span>
      <h2>No products found</h2>
      <p>Try changing the category, search, or stock filters.</p>
      <button type="button" class="catalog-clear" (click)="clear.emit()">Clear filters</button>
    </div>
  `,
  styleUrl: './catalog-empty.css',
})
export class CatalogEmpty {
  readonly clear = output<void>();
}
