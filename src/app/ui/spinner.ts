import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SpinnerVariant = 'default' | 'orbital';

/**
 * The platform progress mark: three tapered ochre arcs orbiting a common
 * centre. Kept as `app-spinner` so every existing Vessa screen picks up the
 * design without a mass rename.
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'app-spinner app-spinner--' + size()",
    '[attr.role]': 'label() ? "status" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-live]': 'label() ? "polite" : null',
  },
  template: `
    <svg
      class="app-spinner__orbits"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      [style.width.px]="pixelSize()"
      [style.height.px]="pixelSize()"
    >
      <path class="app-spinner__arc app-spinner__arc--deep" d="M24 6C31.5 6 38.2 10.6 40.8 17.6" />
      <path class="app-spinner__arc app-spinner__arc--mid" d="M7.2 30.4C5.4 24.4 6.7 17.8 10.8 12.8" />
      <path class="app-spinner__arc app-spinner__arc--soft" d="M36.5 37.2C31.2 42.1 23.4 43.4 16.8 40.5" />
    </svg>
    @if (label()) {
      <span class="app-spinner__label">{{ label() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: var(--text); vertical-align: middle; }
    .app-spinner__orbits {
      flex: none;
      animation: app-orbital-spin 1.15s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
      transform-box: fill-box; transform-origin: center;
    }
    .app-spinner__arc { stroke-width: 4.5; stroke-linecap: round; }
    .app-spinner__arc--deep { stroke: var(--primary, #c88a12); }
    .app-spinner__arc--mid { stroke: color-mix(in srgb, var(--primary, #c88a12) 80%, #fff); }
    .app-spinner__arc--soft { stroke: color-mix(in srgb, var(--primary, #c88a12) 55%, #fff); }
    .app-spinner__label { color: var(--muted); font-size: var(--fs-sm); font-weight: 650; letter-spacing: -0.01em; white-space: nowrap; }
    @keyframes app-orbital-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .app-spinner__orbits { animation-duration: 3s; } }
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md' | 'lg' | number>('md');
  readonly variant = input<SpinnerVariant>('orbital');
  readonly color = input<string>('currentColor');
  readonly speed = input<number | string>('1.3');
  readonly label = input('');

  readonly pixelSize = computed(() => {
    const s = this.size();
    if (typeof s === 'number') return s;
    switch (s) {
      case 'sm': return 12;
      case 'lg': return 24;
      default: return 16;
    }
  });
}
