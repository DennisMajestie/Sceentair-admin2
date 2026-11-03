import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { AnalyticsInventoryMovementPeriod } from '../../core/analytics-api.service';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'app-chart-period-select',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="period-select">
      <button
        class="period-select__button"
        type="button"
        [attr.aria-expanded]="menuOpen()"
        aria-haspopup="menu"
        (click)="toggleMenu()"
      >
        {{ label(period()) }} <app-icon name="chevronDown" [size]="14" />
      </button>
      @if (menuOpen()) {
        <div class="period-select__menu" role="menu" aria-label="Chart interval">
          @for (option of periods; track option) {
            <button
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="period() === option"
              (click)="select(option)"
            >
              {{ label(option) }}
              @if (period() === option) {
                <app-icon name="check" [size]="14" />
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .period-select {
      position: relative;
    }
    .period-select__button {
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 10px;
      border: 1px solid var(--line-2);
      border-radius: var(--sd-r-pill);
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 10px;
      cursor: pointer;
    }
    .period-select__button app-icon {
      color: var(--faint);
    }
    .period-select__menu {
      position: absolute;
      top: calc(100% + 7px);
      right: 0;
      z-index: 5;
      width: 156px;
      padding: 5px;
      border: 1px solid var(--line-2);
      border-radius: 14px;
      background: var(--sd-card);
      box-shadow: var(--sd-shadow);
    }
    .period-select__menu button {
      width: 100%;
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 9px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 10px;
      text-align: left;
      cursor: pointer;
    }
    .period-select__menu button:hover,
    .period-select__menu button[aria-checked='true'] {
      background: var(--well);
    }
  `,
})
export class ChartPeriodSelect {
  readonly period = input.required<AnalyticsInventoryMovementPeriod>();
  readonly periodChange = output<AnalyticsInventoryMovementPeriod>();
  protected readonly menuOpen = signal(false);
  protected readonly periods: AnalyticsInventoryMovementPeriod[] = [
    'weekly',
    'monthly',
    'quarterly',
  ];

  protected label(period: AnalyticsInventoryMovementPeriod): string {
    return period[0].toUpperCase() + period.slice(1);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected select(period: AnalyticsInventoryMovementPeriod): void {
    this.menuOpen.set(false);
    this.periodChange.emit(period);
  }
}
