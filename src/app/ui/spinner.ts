import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from '@angular/core';
import { helix, infinity, mirage, orbit, pulsar, quantum, ring2, waveform } from 'ldrs';

// Register custom elements safely in browser context
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  quantum.register();
  ring2.register();
  helix.register();
  infinity.register();
  pulsar.register();
  orbit.register();
  waveform.register();
  mirage.register();
}

export type SpinnerVariant =
  | 'default'
  | 'quantum'
  | 'ring'
  | 'helix'
  | 'infinity'
  | 'pulsar'
  | 'orbit'
  | 'waveform'
  | 'mirage'
  | 'orbital';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @switch (variant()) {
      @case ('quantum') {
        <l-quantum
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-quantum>
      }
      @case ('ring') {
        <l-ring-2
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          stroke="3"
          stroke-length="0.25"
          bg-opacity="0.1"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-ring-2>
      }
      @case ('helix') {
        <l-helix
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-helix>
      }
      @case ('infinity') {
        <l-infinity
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          stroke="3"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-infinity>
      }
      @case ('pulsar') {
        <l-pulsar
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-pulsar>
      }
      @case ('orbit') {
        <l-orbit
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-orbit>
      }
      @case ('waveform') {
        <l-waveform
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-waveform>
      }
      @case ('mirage') {
        <l-mirage
          [attr.size]="pixelSize()"
          [attr.speed]="speed()"
          [attr.color]="color()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        ></l-mirage>
      }
      @case ('orbital') {
        <svg
          class="spinner-orbital"
          viewBox="0 0 48 48"
          fill="none"
          [attr.width]="pixelSize()"
          [attr.height]="pixelSize()"
          role="status"
          [attr.aria-label]="label() || 'Loading'"
        >
          <path class="spinner-orbital__dark" d="M24 6C31.5 6 38.2 10.6 40.8 17.6" stroke-width="4.5" stroke-linecap="round" />
          <path class="spinner-orbital__mid" d="M7.2 30.4C5.4 24.4 6.7 17.8 10.8 12.8" stroke-width="4.5" stroke-linecap="round" />
          <path class="spinner-orbital__soft" d="M36.5 37.2C31.2 42.1 23.4 43.4 16.8 40.5" stroke-width="4.5" stroke-linecap="round" />
        </svg>
      }
      @default {
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
      }
    }
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
    .spinner-orbital {
      --arc-dark: var(--warn);
      --arc-mid: var(--ochre);
      --arc-soft: color-mix(in srgb, var(--ochre) 55%, #fff);
      animation: sd-orbital 1.15s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .spinner-orbital__dark { stroke: var(--arc-dark); }
    .spinner-orbital__mid { stroke: var(--arc-mid); }
    .spinner-orbital__soft { stroke: var(--arc-soft); }
    @keyframes sd-orbital {
      to { transform: rotate(1turn); }
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
      .spinner-orbital { animation-duration: 2.4s; }
    }
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md' | 'lg' | number>('md');
  readonly variant = input<SpinnerVariant>('quantum');
  readonly color = input<string>('currentColor');
  readonly speed = input<number | string>('1.3');
  readonly label = input('');

  protected readonly pixelSize = computed(() => {
    const s = this.size();
    if (typeof s === 'number') return s;
    switch (s) {
      case 'sm':
        return 16;
      case 'lg':
        return 40;
      default:
        return 24;
    }
  });
}
