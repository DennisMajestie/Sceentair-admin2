import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ShotKind = 'balm' | 'oil' | 'serum' | 'fluid' | 'gel' | 'duo';

interface Palette {
  bg: string;
  body: string;
  cap: string;
  accent: string;
}

const PALETTES: Record<string, Palette> = {
  balm: { bg: '#f3e7d8', body: '#c98a52', cap: '#7a4a22', accent: '#f7d9ae' },
  oil: { bg: '#e4efea', body: '#6fae8b', cap: '#2f5f46', accent: '#cfe8d9' },
  serum: { bg: '#ece6f2', body: '#8d7bb0', cap: '#463a5c', accent: '#dcd2ea' },
  fluid: { bg: '#f7e9e4', body: '#d08b6c', cap: '#8a4a34', accent: '#f6d5c4' },
  gel: { bg: '#e3eef3', body: '#6ba3bd', cap: '#2f5a6c', accent: '#c6e2ef' },
  duo: { bg: '#f1ecdf', body: '#b9a765', cap: '#6d5f2f', accent: '#ece2c2' },
};

/**
 * Stylised product artwork. The reference build shipped generated SVG imagery
 * keyed by a `photo` slug; this renders an original equivalent per slug.
 */
@Component({
  selector: 'app-product-shot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.background]': 'palette().bg' },
  template: `
    <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="label()">
      @switch (kind()) {
        @case ('balm') {
          <ellipse cx="60" cy="92" rx="34" ry="7" class="sh" />
          <rect x="30" y="56" width="60" height="32" rx="10" [attr.fill]="p().body" />
          <rect x="30" y="56" width="60" height="12" rx="6" [attr.fill]="p().accent" opacity=".55" />
          <rect x="36" y="36" width="48" height="22" rx="8" [attr.fill]="p().cap" />
          <rect x="44" y="46" width="32" height="6" rx="3" fill="#ffffff" opacity=".45" />
          <rect x="44" y="72" width="32" height="4" rx="2" fill="#ffffff" opacity=".5" />
        }
        @case ('oil') {
          <ellipse cx="60" cy="96" rx="22" ry="6" class="sh" />
          <rect x="48" y="44" width="24" height="48" rx="9" [attr.fill]="p().body" />
          <rect x="52" y="56" width="6" height="30" rx="3" fill="#ffffff" opacity=".35" />
          <rect x="54" y="28" width="12" height="18" rx="3" [attr.fill]="p().cap" />
          <rect x="52" y="18" width="16" height="12" rx="5" [attr.fill]="p().cap" />
          <rect x="48" y="70" width="24" height="4" rx="2" fill="#ffffff" opacity=".45" />
        }
        @case ('serum') {
          <ellipse cx="60" cy="96" rx="26" ry="6" class="sh" />
          <rect x="40" y="48" width="40" height="44" rx="12" [attr.fill]="p().body" />
          <rect x="45" y="60" width="6" height="24" rx="3" fill="#ffffff" opacity=".32" />
          <rect x="54" y="34" width="12" height="16" rx="3" [attr.fill]="p().cap" />
          <rect x="50" y="26" width="20" height="10" rx="5" [attr.fill]="p().cap" />
          <rect x="46" y="72" width="28" height="4" rx="2" fill="#ffffff" opacity=".45" />
        }
        @case ('fluid') {
          <ellipse cx="60" cy="96" rx="28" ry="6" class="sh" />
          <path d="M34 48h52l-4 44a6 6 0 01-6 5H44a6 6 0 01-6-5z" [attr.fill]="p().body" />
          <rect x="44" y="60" width="7" height="26" rx="3.5" fill="#ffffff" opacity=".3" />
          <rect x="48" y="30" width="24" height="20" rx="5" [attr.fill]="p().cap" />
          <rect x="44" y="80" width="32" height="4" rx="2" fill="#ffffff" opacity=".45" />
        }
        @case ('gel') {
          <ellipse cx="60" cy="96" rx="20" ry="5" class="sh" />
          <path d="M46 34h28l6 56a6 6 0 01-6 6H46a6 6 0 01-6-6z" [attr.fill]="p().body" />
          <rect x="50" y="48" width="6" height="30" rx="3" fill="#ffffff" opacity=".32" />
          <rect x="48" y="24" width="24" height="12" rx="4" [attr.fill]="p().cap" />
          <rect x="48" y="76" width="24" height="4" rx="2" fill="#ffffff" opacity=".45" />
        }
        @case ('duo') {
          <ellipse cx="60" cy="96" rx="34" ry="6" class="sh" />
          <rect x="26" y="54" width="30" height="38" rx="9" [attr.fill]="p().body" opacity=".85" />
          <rect x="30" y="40" width="22" height="16" rx="4" [attr.fill]="p().cap" />
          <rect x="60" y="44" width="34" height="48" rx="11" [attr.fill]="p().body" />
          <rect x="66" y="30" width="22" height="16" rx="4" [attr.fill]="p().cap" />
          <rect x="66" y="62" width="6" height="22" rx="3" fill="#ffffff" opacity=".3" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    .sh {
      fill: #00000018;
    }
  `,
})
export class ProductShot {
  readonly photo = input<string>('serum');
  readonly label = input('Product image');

  protected readonly kind = computed<ShotKind>(() => {
    const key = this.photo() as ShotKind;
    return PALETTES[key] ? key : 'serum';
  });
  protected readonly palette = computed(() => PALETTES[this.kind()]);
  protected readonly p = computed(() => this.palette());
}
