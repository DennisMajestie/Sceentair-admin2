import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="spinner"
      [class.spinner--sm]="size() === 'sm'"
      [class.spinner--lg]="size() === 'lg'"
      role="status"
      [attr.aria-label]="label() || 'Loading'"
    >
      <span class="spinner__ring"></span>
      <span class="spinner__ring spinner__ring--reverse"></span>
      <span class="spinner__core"></span>
    </span>
    @if (label()) {
      <span class="spinner__label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      color: inherit;
      vertical-align: middle;
    }
    .spinner {
      --spin-size: 22px;
      --spin-stroke: 2px;
      position: relative;
      display: block;
      inline-size: var(--spin-size);
      block-size: var(--spin-size);
      flex: 0 0 auto;
    }
    .spinner--sm {
      --spin-size: 15px;
      --spin-stroke: 1.5px;
    }
    .spinner--lg {
      --spin-size: 42px;
      --spin-stroke: 3px;
    }
    .spinner__ring {
      position: absolute;
      inset: 0;
      border: var(--spin-stroke) solid color-mix(in srgb, currentColor 18%, transparent);
      border-block-start-color: currentColor;
      border-inline-end-color: currentColor;
      border-radius: 50%;
      animation: sd-spin 0.85s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
    }
    .spinner__ring--reverse {
      inset: 22%;
      border-color: color-mix(in srgb, currentColor 14%, transparent);
      border-block-end-color: currentColor;
      border-inline-start-color: currentColor;
      animation-duration: 1.2s;
      animation-direction: reverse;
      opacity: 0.75;
    }
    .spinner__core {
      position: absolute;
      inset: 43%;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 40%, transparent);
      animation: sd-spin-pulse 1.4s ease-out infinite;
    }
    .spinner__label {
      color: var(--muted);
      font-size: var(--fs-sm);
      font-weight: 650;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    @keyframes sd-spin {
      to { transform: rotate(1turn); }
    }
    @keyframes sd-spin-pulse {
      70%, 100% { box-shadow: 0 0 0 6px transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner__ring { animation-duration: 2.4s; }
      .spinner__core { animation: none; }
    }
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input('');
}
