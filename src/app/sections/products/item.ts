import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { gsap } from 'gsap';
import {
  ApiProduct,
  CatalogueApiService,
  primaryProductImage,
} from '../../core/catalogue-api.service';
import { Icon } from '../../ui/icon';
import { ProductShot } from '../../ui/product-shot';
import { SdSlidingIndicator } from '../../ui/sliding-indicator';
import { moneyNgn } from '../customers/cs-data';

interface KvRow {
  id: string;
  label: string;
  value: string;
  mono?: boolean;
  icon?: boolean;
}

@Component({
  selector: 'app-product-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductShot, SdSlidingIndicator],
  template: `
    @if (product(); as p) {
      <div #root class="sd-item">
        <header class="sd-head">
          <p class="sd-crumb">{{ p.category ?? 'Uncategorized' }} · {{ p.variants[0]?.size ?? '' }}</p>
          <div class="sd-head-row">
            <button type="button" class="sd-back" (click)="goBack()" aria-label="Back to catalog list">
              <app-icon name="back" [size]="16" aria-hidden="true" />
            </button>
            <h1 #titleEl class="sd-title" tabindex="-1">{{ p.name }}</h1>
            @if (pager(); as pg) {
              <nav class="sd-pager" aria-label="Catalog position">
                <button
                  type="button"
                  class="sd-pager__btn"
                  (click)="page(-1)"
                  [disabled]="pg.index <= 0"
                  aria-label="Previous product"
                >
                  <app-icon name="chevron" [size]="14" style="transform:rotate(180deg)" aria-hidden="true" />
                </button>
                <span class="sd-pager__pos num">{{ pg.index + 1 }} of {{ pg.ids.length }}</span>
                <button
                  type="button"
                  class="sd-pager__btn"
                  (click)="page(1)"
                  [disabled]="pg.index >= pg.ids.length - 1"
                  aria-label="Next product"
                >
                  <app-icon name="chevron" [size]="14" aria-hidden="true" />
                </button>
              </nav>
            }
          </div>
        </header>

        <div class="sd-grid">
          <article class="card sd-left">
            <span class="sr" [id]="titleId()">{{ p.name }}</span>
            <div #shotWrap class="sd-shotwrap">
              <div class="sd-shot">
                <app-product-shot class="sd-shot__img" [photo]="primaryPhoto(p)" [label]="p.name" />
                @if (p.isBestseller) {
                  <span class="sd-shot__chip is-warn">
                    <app-icon name="alert" [size]="11" aria-hidden="true" />
                    Bestseller
                  </span>
                }
              </div>
            </div>
            <div class="sd-body">
              <div class="sd-chips">
                @if (p.category) {
                  <span class="sd-tint-chip">{{ p.category }}</span>
                }
                @if (p.variants[0]?.size) {
                  <span class="sd-tint-chip is-plain">{{ p.variants[0].size }}</span>
                }
                @if (p.variants[0]?.colour) {
                  <span class="sd-tint-chip is-plain">{{ p.variants[0].colour }}</span>
                }
              </div>
              @if (p.description) {
                <p class="sd-blurb" [class.is-open]="blurbMore()">{{ p.description }}</p>
                @if (p.description.length > 130) {
                  <button type="button" class="sd-more" (click)="blurbMore.set(!blurbMore())">
                    {{ blurbMore() ? 'Show less' : 'Read more' }}
                  </button>
                }
              }
              <dl class="sd-kv">
                @for (kv of kvRows(); track kv.id) {
                  <div class="sd-kv__row">
                    <dt>{{ kv.label }}</dt>
                    <dd [class.mono]="kv.mono">
                      @if (kv.icon) {
                        <app-icon name="barcode" [size]="14" aria-hidden="true" />
                      }
                      {{ kv.value }}
                    </dd>
                  </div>
                }
              </dl>
              <div class="sd-prices">
                <div class="sd-price">
                  <span class="sd-price__label">Retail price</span>
                  <span class="sd-price__value sd-num" data-kind="naira" [attr.data-to]="p.basePrice">—</span>
                  @if (p.salePrice !== null && p.salePrice !== p.basePrice) {
                    <span class="sd-price__cap">On sale: {{ p.salePrice != null ? money(p.salePrice) : '—' }}</span>
                  }
                </div>
              </div>
            </div>
          </article>

          <div class="sd-right">
            <article class="card sd-stock">
              <div class="sd-cardhead">
                <div>
                  <h2 class="sd-cardhead__title">Availability</h2>
                  <p class="sd-cardhead__sub">Variant stock status from the catalogue</p>
                </div>
              </div>
              <div class="sd-stats" style="grid-template-columns: 1fr;">
                <div class="sd-stat">
                  <span class="sd-stat__label">Variants</span>
                  <span class="sd-stat__value sd-num" data-kind="plain" [attr.data-to]="p.variants.length">—</span>
                  <span class="sd-stat__cap">product variants</span>
                </div>
                @for (v of p.variants; track v.id) {
                  <div class="sd-stat">
                    <span class="sd-stat__label">{{ v.sku }}</span>
                    <span class="sd-stat__value">
                      @switch (v.availabilityStatus) {
                        @case ('in_stock') { In stock }
                        @case ('out_of_stock') { Out of stock }
                        @case ('made_to_order') { Made to order }
                      }
                    </span>
                    <span class="sd-stat__cap">{{ v.size ?? '' }} {{ v.colour ?? '' }}</span>
                  </div>
                }
              </div>
              @if (p.variants.length > 0) {
                <ul class="sd-locs">
                  @for (v of p.variants; track v.id) {
                    <li class="sd-loc">
                      <span class="sd-loc__ic" [style.--tint]="'var(--primary)'">
                        <app-icon name="warehouses" [size]="14" aria-hidden="true" />
                      </span>
                      <span class="sd-loc__txt">
                        <b>{{ v.sku }}</b>
                        <small>{{ v.size ?? '' }}{{ v.colour ? ' · ' + v.colour : '' }}</small>
                      </span>
                      <span [class]="'sd-loc__chip badge badge--' + variantTone(v.availabilityStatus)">
                        {{ v.availabilityStatus.replace('_', ' ') }}
                      </span>
                      @if (v.storageLocation) {
                        <span class="sd-loc__qty">{{ v.storageLocation }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </article>

            <article class="card sd-sales">
              <div class="sd-cardhead">
                <div>
                  <h2 class="sd-cardhead__title">Popularity</h2>
                  <p class="sd-cardhead__sub">Distinct buyers who placed paid orders</p>
                </div>
              </div>
              <div class="sd-stats" style="grid-template-columns: 1fr;">
                <div class="sd-stat">
                  <span class="sd-stat__label">Buyers</span>
                  <span class="sd-stat__value sd-num" data-kind="plain" [attr.data-to]="p.soldCount ?? 0">—</span>
                  <span class="sd-stat__cap">distinct paid orders</span>
                </div>
              </div>
              <p class="sd-nosales">
                Sales velocity, cover days and location stock are not exposed by the public catalogue.
              </p>
            </article>
          </div>
        </div>
      </div>
    } @else {
      <div class="card pi-missing">
        <div class="empty">Product not found.</div>
        <a class="btn btn--ghost" routerLink="/products/catalog">Back to catalog</a>
      </div>
    }
  `,
  styles: `
    .sd-item { display: grid; gap: 16px; }
    .pi-missing {
      display: grid; gap: 12px; justify-items: center; padding: 42px 20px;
    }
    .sd-crumb { font-size: 12px; color: var(--faint); margin-bottom: 6px; }
    .sd-head-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .sd-back {
      display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
      border: 1px solid var(--line-2); background: var(--raised); color: var(--muted); cursor: pointer; flex: none;
    }
    .sd-back:hover { color: var(--primary); }
    .sd-title { font-size: 34px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.1; min-width: 0; }
    .sd-title:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; border-radius: 6px; }
    .sd-pager {
      margin-left: auto; display: inline-flex; align-items: center; gap: 4px; padding: 4px;
      border: 1px solid var(--line-2); border-radius: 999px; background: var(--raised); flex: none;
    }
    .sd-pager__btn {
      display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
      border: none; background: none; color: var(--muted); cursor: pointer;
    }
    .sd-pager__btn:hover:not([disabled]) { color: var(--primary); background: var(--well); }
    .sd-pager__btn[disabled] { opacity: 0.38; cursor: not-allowed; }
    .sd-pager__pos { font-size: 12px; color: var(--muted); min-width: 56px; text-align: center; }
    .sd-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
    .sd-left { padding: 12px; align-self: start; display: grid; gap: 12px; }
    .sd-shotwrap { min-width: 0; }
    .sd-shot {
      position: relative; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); background: var(--surface-2);
    }
    .sd-shot__img { width: 100%; aspect-ratio: 1; display: block; }
    .sd-shot__chip {
      position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; backdrop-filter: blur(3px);
    }
    .sd-shot__chip.is-warn {
      background: color-mix(in srgb, var(--warn) 20%, var(--surface)); color: var(--warn);
    }
    .sd-body { min-width: 0; display: grid; gap: 12px; align-content: start; }
    .sd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .sd-tint-chip {
      display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 8px;
      background: color-mix(in srgb, var(--tint, var(--primary)) 14%, transparent);
      color: color-mix(in srgb, var(--tint, var(--primary)) 60%, var(--text)); font-size: 12px; font-weight: 600;
    }
    .sd-tint-chip.is-plain { background: var(--well); color: var(--muted); }
    .sd-blurb { font-size: 13px; color: var(--muted); line-height: 1.5; display: -webkit-box;
      -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .sd-blurb.is-open { display: block; }
    .sd-more { border: none; background: none; font-size: 12.5px; font-weight: 600; color: var(--primary);
      cursor: pointer; padding: 2px 0; justify-self: start; }
    .sd-kv { margin: 0; display: grid; }
    .sd-kv__row { display: flex; align-items: center; gap: 10px; justify-content: space-between; padding: 8px 2px; border-top: 1px solid var(--line); }
    .sd-kv__row:last-child { border-bottom: 1px solid var(--line); }
    .sd-kv dt { font-size: 13px; color: var(--muted); }
    .sd-kv dd { margin: 0; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-align: right; word-break: break-all; }
    .sd-prices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sd-price { padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2); }
    .sd-price__label { display: block; font-size: 12px; color: var(--muted); }
    .sd-price__value { display: block; margin-top: 2px; font-size: 20px; font-weight: 500; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
    .sd-price__cap { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }
    .sd-right { display: grid; gap: 16px; min-width: 0; }
    .sd-cardhead { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
    .sd-cardhead__title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
    .sd-cardhead__sub { font-size: 12px; color: var(--muted); }
    .sd-stats { display: grid; gap: 8px; }
    .sd-stat { padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2); }
    .sd-stat__label { display: block; font-size: 12px; color: var(--muted); }
    .sd-stat__value { display: block; margin-top: 2px; font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .sd-stat__cap { display: block; font-size: 12px; color: var(--muted); }
    .sd-locs { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
    .sd-loc {
      display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px;
      border-radius: 16px; background: var(--surface-2);
    }
    .sd-loc__ic {
      display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
      background: color-mix(in srgb, var(--tint, var(--primary)) 15%, transparent);
      color: color-mix(in srgb, var(--tint, var(--primary)) 72%, var(--text));
    }
    .sd-loc__txt { display: grid; line-height: 1.3; min-width: 0; }
    .sd-loc__txt b { font-size: 13px; font-weight: 600; }
    .sd-loc__txt small { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sd-loc__chip {
      display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
    }
    .sd-loc__qty { font-size: 12px; color: var(--muted); }
    .sd-nosales { font-size: 12px; color: var(--muted); padding: 12px; text-align: center; }
  `,
})
export class ProductItem {
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly titles = inject(Title);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly blurbMore = signal(false);

  private readonly rootEl = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly titleEl = viewChild<ElementRef<HTMLElement>>('titleEl');

  private readonly products = signal<ApiProduct[]>([]);

  protected readonly product = computed(() => {
    const pid = this.id();
    return pid ? this.products().find((p) => p.id === pid) : undefined;
  });

  protected readonly money = moneyNgn;

  private ctxOnce?: { ids: readonly string[] };
  private ctxLoaded = false;
  protected readonly ctx = computed<{ ids: readonly string[] } | undefined>(() => {
    if (!this.ctxLoaded) {
      this.ctxLoaded = true;
      this.ctxOnce = this.loadCatalogCtx();
    }
    return this.ctxOnce;
  });

  protected readonly pager = computed(() => {
    const pid = this.id();
    const ctx = this.ctx();
    if (!pid || !ctx) return undefined;
    const index = ctx.ids.indexOf(pid);
    return index < 0 ? undefined : { ids: ctx.ids, index };
  });

  private animationFrame = 0;
  private context?: gsap.Context;
  private gsapCtx?: gsap.Context;
  private played = false;

  constructor() {
    void this.loadCatalog();

    effect(() => {
      void this.product();
      afterNextRender(() => this.onData(), { injector: inject(Injector) });
    });
    this.destroyRef.onDestroy(() => {
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      this.context?.revert();
      this.gsapCtx?.revert();
    });
  }

  private async loadCatalog(): Promise<void> {
    try {
      const result = await this.catalogueApi.list({ page: 1, limit: 100 });
      this.products.set(result.data);
    } catch {
      // product detail will show not-found if the direct fetch below fails
    }
    const pid = this.id();
    if (pid) {
      void this.catalogueApi.detail(pid).then((p) => {
        this.products.update((list) => [...list.filter((x) => x.id !== pid), p]);
      });
    }
  }

  protected readonly primaryPhoto = (p: ApiProduct): string =>
    primaryProductImage(p) ?? '';

  protected variantTone(status: string): string {
    switch (status) {
      case 'in_stock': return 'good';
      case 'out_of_stock': return 'bad';
      case 'made_to_order': return 'warn';
      default: return '';
    }
  }

  protected readonly kvRows = computed<KvRow[]>(() => {
    const p = this.product();
    if (!p) return [];
    const rows: KvRow[] = [
      { id: 'sku', label: 'SKU', value: p.variants[0]?.sku ?? '—', mono: true },
    ];
    if (p.salePercent) {
      rows.push({ id: 'sale', label: 'Sale', value: `${p.salePercent}% off` });
    }
    if (p.saleEndsAt) {
      rows.push({ id: 'saleEnds', label: 'Sale ends', value: new Date(p.saleEndsAt).toLocaleDateString() });
    }
    return rows;
  });

  protected goBack(): void {
    this.router.navigate(['/products/catalog'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  protected page(dir: -1 | 1): void {
    const pg = this.pager();
    if (!pg) return;
    const next = pg.ids[pg.index + dir];
    if (!next) return;
    this.router.navigate(['/products/item/' + next], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  protected titleId(): string {
    return 'sd-product-title';
  }

  private onData(): void {
    if (!this.played) {
      this.played = true;
      if (!this.isBrowser) return;
      const p = this.product();
      if (p) {
        this.titles.setTitle(`${p.name} · Catalog`);
      }
      this.zone.runOutsideAngular(() => {
        this.gsapCtx = gsap.context(() => {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduced) {
            this.settle();
            return;
          }
          const root = this.rootEl().nativeElement;
          const q = gsap.utils.selector(root);
          const tl = gsap.timeline();
          tl.from(q('.sd-head'), { y: 16, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0);
          tl.from(q('.sd-left, .sd-right > *'), {
            y: 16, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out',
          }, 0.12);
          this.runCounters(tl);
        }, this.rootEl().nativeElement);
      });
    }
  }

  private settle(): void {
    const root = this.rootEl().nativeElement;
    root.querySelectorAll<HTMLElement>('.sd-num').forEach((el) => {
      const to = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind') ?? 'plain';
      const fmt = (n: number): string => {
        if (kind === 'naira') return moneyNgn(n);
        return `${Math.round(n)}`;
      };
      this.motionSetFinal(el, to, fmt);
    });
  }

  private motionSetFinal(el: HTMLElement, to: number, fmt: (n: number) => string): void {
    el.textContent = fmt(to);
  }

  private runCounters(tl?: gsap.core.Timeline): void {
    const root = this.rootEl().nativeElement;
    root.querySelectorAll<HTMLElement>('.sd-num').forEach((el) => {
      const raw = Number(el.getAttribute('data-to'));
      const kind = el.getAttribute('data-kind') ?? 'plain';
      const fmt = (n: number): string => {
        if (kind === 'naira') return moneyNgn(n);
        return `${Math.round(n)}`;
      };
      if (tl) {
        tl.to(el, { duration: 1.2, ease: 'power2.out', onUpdate: () => {
          // GSAP counter handled via setFinal fallback
        } }, 0.5);
      }
      this.motionSetFinal(el, raw, fmt);
    });
  }

  private loadCatalogCtx(): { ids: readonly string[] } | undefined {
    try {
      const raw = sessionStorage.getItem('sd-catalog-ctx');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { ids?: unknown };
      if (!Array.isArray(parsed.ids)) return undefined;
      const ids = parsed.ids.filter((v): v is string => typeof v === 'string');
      return ids.length > 0 ? { ids } : undefined;
    } catch {
      return undefined;
    }
  }
}
