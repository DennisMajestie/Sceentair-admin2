import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import {
  ApiProduct,
  ApiProductVariant,
  CatalogueApiService,
  primaryProductImage,
} from '../../core/catalogue-api.service';
import { Icon } from '../../ui/icon';
import { SdSlidingIndicator } from '../../ui/sliding-indicator';
import { CatalogApiProductCard } from './catalog-api-product-card';
import { CatalogApiProductEditor } from './catalog-product-editor';
import { CatalogEmpty } from './catalog-empty';
import { CatalogApiProductList } from './catalog-api-product-list';
import { moneyNgn } from '../customers/cs-data';

let savedY = 0;

export interface CatalogRow {
  id: string;
  name: string;
  category: string | null;
  photo: string | null;
  price: number;
  isBestseller: boolean;
  soldCount: number;
  variants: ApiProductVariant[];
}

interface CatalogMetric {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: string;
}

const DEFAULT_QUERY: CatalogQueryState = {
  query: '',
  category: 'all',
  sort: 'name',
  direction: 'asc',
  view: 'grid',
};

type CatalogCategoryFilter = string;
type CatalogDirection = 'asc' | 'desc';
type CatalogSort = 'name' | 'price';
type CatalogView = 'grid' | 'list';

interface CatalogQueryState {
  query: string;
  category: CatalogCategoryFilter;
  sort: CatalogSort;
  direction: CatalogDirection;
  view: CatalogView;
}

const toneColors = ['pine', 'ocean', 'ochre', 'sage', 'rose', 'slate'];

function categoryHash(name: string | null): number {
  if (!name) return 0;
  return [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

function categoryTone(name: string | null): string {
  return toneColors[categoryHash(name) % toneColors.length];
}

function productPrice(product: ApiProduct): number {
  return product.salePrice ?? product.basePrice;
}

function mapRow(product: ApiProduct): CatalogRow {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    photo: primaryProductImage(product),
    price: productPrice(product),
    isBestseller: product.isBestseller,
    soldCount: product.soldCount ?? 0,
    variants: product.variants,
  };
}

@Component({
  selector: 'app-products-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CatalogApiProductCard, CatalogApiProductEditor, CatalogEmpty, CatalogApiProductList, SdSlidingIndicator],
  template: `
    <main #root class="catalog-page">
      <header class="catalog-head" data-enter>
        <div class="catalog-head__copy">
          <p class="catalog-eyebrow">Inventory <span aria-hidden="true">/</span> API</p>
          <h1>Product catalog</h1>
          <p class="catalog-head__lead">
            {{ rows().length }} products across {{ categories().length }} categories.
          </p>
        </div>
        <div class="catalog-head__actions">
          <button class="btn btn--primary" type="button" (click)="openCreate()">+ New product</button>
          <a class="catalog-batches" routerLink="/products/batches">
            <app-icon name="layers" [size]="16" aria-hidden="true" />
            <span>Batches</span>
            <app-icon class="catalog-batches__arrow" name="chevron" [size]="14" aria-hidden="true" />
          </a>
        </div>
      </header>

      <p class="catalog-demo-note" role="note" data-enter>
        <app-icon name="diamond" [size]="15" aria-hidden="true" />
        <span>
          Product data from the API. Inventory levels, cost and reorder rules are
          not exposed by the public catalogue and are not shown here.
        </span>
      </p>

      <section class="catalog-metrics" aria-label="Catalog summary">
        @for (metric of metrics(); track metric.label) {
          <article class="catalog-metric" data-enter>
            <div class="catalog-metric__top">
              <span
                class="catalog-metric__icon"
                [class.tone-primary]="metric.tone === 'primary'"
                [class.tone-ocean]="metric.tone === 'ocean'"
                [class.tone-warn]="metric.tone === 'warn'"
                [class.tone-teal]="metric.tone === 'teal'"
                [class.tone-rose]="metric.tone === 'rose'"
              >
                <app-icon [name]="metric.icon" [size]="17" aria-hidden="true" />
              </span>
              <span class="catalog-metric__label">{{ metric.label }}</span>
            </div>
            <p class="catalog-metric__value">{{ metric.value }}</p>
            <p class="catalog-metric__detail">{{ metric.detail }}</p>
          </article>
        }
      </section>

      <section class="catalog-island" aria-label="Product inventory">
        <div class="catalog-toolbar" data-enter>
          <div
            class="category-strip"
            role="group"
            aria-label="Filter products by category"
            sdSlidingIndicator
            itemSelector=".category-chip"
            bg="var(--sd-dark)"
            radius="var(--sd-r-pill)"
          >
            <button
              type="button"
              class="category-chip"
              [class.is-on]="queryState().category === 'all'"
              [attr.aria-pressed]="queryState().category === 'all'"
              (click)="setCategory('all')"
            >
              <span class="category-chip__text">All products</span>
              <span class="category-chip__count">{{ rows().length }}</span>
            </button>
            @for (category of categories(); track category.id) {
              <button
                type="button"
                class="category-chip"
                [class.is-on]="queryState().category === category.id"
                [attr.aria-pressed]="queryState().category === category.id"
                [style.--category-color]="categoryTone(category.name)"
                (click)="setCategory(category.name)"
              >
                <span class="category-dot" aria-hidden="true"></span>
                <span class="category-chip__text">{{ category.name }}</span>
                <span class="category-chip__count">{{ categoryCount(category.id) }}</span>
              </button>
            }
          </div>

          <div class="catalog-tools">
            <label class="catalog-search">
              <app-icon name="search" [size]="16" aria-hidden="true" />
              <span class="sr">Search products by name, SKU, or category</span>
              <input
                type="search"
                placeholder="Search products"
                autocomplete="off"
                [value]="searchDraft()"
                (input)="onSearchInput($event)"
              />
              @if (searchDraft()) {
                <button
                  type="button"
                  class="catalog-search__clear"
                  aria-label="Clear search"
                  (click)="clearSearch()"
                >
                  <app-icon name="close" [size]="14" aria-hidden="true" />
                </button>
              }
            </label>

            <label class="catalog-sort">
              <span class="sr">Sort products</span>
              <select [value]="sortValue()" (change)="onSortChange($event)">
                @for (option of sortOptions; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              <app-icon name="chevronDown" [size]="13" aria-hidden="true" />
            </label>

            <div
              class="catalog-view"
              role="group"
              aria-label="Catalog view"
              sdSlidingIndicator
              itemSelector=".catalog-view__button"
              bg="var(--sd-dark)"
              radius="var(--sd-r-pill)"
            >
              <button
                type="button"
                class="catalog-view__button"
                [class.is-on]="queryState().view === 'grid'"
                [attr.aria-pressed]="queryState().view === 'grid'"
                aria-label="Grid view"
                (click)="setView('grid')"
              >
                <app-icon name="grid" [size]="16" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="catalog-view__button"
                [class.is-on]="queryState().view === 'list'"
                [attr.aria-pressed]="queryState().view === 'list'"
                aria-label="List view"
                (click)="setView('list')"
              >
                <app-icon name="list" [size]="17" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div class="catalog-results">
          <p class="catalog-results__count" aria-live="polite">
            <strong>{{ visibleRows().length }}</strong>
            {{ visibleRows().length === 1 ? 'product' : 'products' }}
            <span>of {{ rows().length }}</span>
          </p>
          <p class="catalog-results__sort">Sorted by {{ sortLabel() }}</p>
          @if (urlError()) {
            <p class="catalog-url-error" role="alert">{{ urlError() }}</p>
          }
        </div>

        @if (loading() && rows().length === 0) {
          <div class="catalog-empty cs-skel" aria-hidden="true">
            @for (i of [0, 1, 2, 3, 4, 5, 6, 7]; track i) {
              <div class="cs-skel__card"></div>
            }
          </div>
        } @else if (visibleRows().length === 0) {
          <app-catalog-empty data-enter (clear)="clearFilters()" />
        } @else if (queryState().view === 'grid') {
          <div class="product-grid">
            @for (row of visibleRows(); track row.id) {
              <app-catalog-api-product-card
                [row]="row"
                [queryParams]="urlQueryParams()"
                [catalogIds]="visibleIds()"
                [money]="money"
                [onEdit]="openEdit"
              />
            }
          </div>
        } @else {
          <app-catalog-api-product-list
            class="catalog-table-wrap"
            data-enter
            [rows]="visibleRows()"
            [queryParams]="urlQueryParams()"
            [catalogIds]="visibleIds()"
            [sort]="queryState().sort"
            [direction]="queryState().direction"
            [money]="money"
            [onEdit]="openEdit"
            (sortChange)="sortHeader($event)"
          />
        }

        @if (error()) {
          <div class="notice notice--error" role="alert">{{ error() }}</div>
        }
      </section>

      <app-catalog-product-editor
        [open]="editorOpen()"
        [product]="editorProduct()"
        [categories]="categories()"
        (saved)="onEditorSaved()"
        (closed)="closeEditor()"
      />
    </main>
  `,
  styleUrl: './catalog.css',
})
export class ProductsCatalog {
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private context?: gsap.Context;
  private fillObserver?: IntersectionObserver;
  private readonly observedFills = new WeakSet<HTMLElement>();
  private searchTimer?: ReturnType<typeof setTimeout>;
  private animationFrame = 0;
  private urlNavigation = 0;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly products = signal<ApiProduct[]>([]);
  protected readonly categories = signal<{ id: string; name: string }[]>([]);

  protected readonly queryState = signal<CatalogQueryState>(DEFAULT_QUERY);
  protected readonly searchDraft = signal('');
  protected readonly urlError = signal('');
  protected readonly urlQueryParams = computed(() => ({
    q: this.queryState().query,
    category: this.queryState().category,
    sort: this.queryState().sort,
    dir: this.queryState().direction,
    view: this.queryState().view,
  }));
  protected readonly money = moneyNgn;

  protected readonly rows = computed<CatalogRow[]>(() => this.products().map(mapRow));

  protected readonly visibleRows = computed<CatalogRow[]>(() => {
    const q = this.queryState().query.trim().toLowerCase();
    const cat = this.queryState().category;
    let list = this.rows();
    if (cat && cat !== 'all') {
      list = list.filter((r) => r.category === cat);
    }
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.variants.some((v) => v.sku.toLowerCase().includes(q)) ||
        (r.category ?? '').toLowerCase().includes(q),
    );
  });

  protected readonly visibleIds = computed(() => this.visibleRows().map((row) => row.id));

  protected readonly editorProductId = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly editorProduct = computed<ApiProduct | null>(() => {
    const id = this.editorProductId();
    if (!id) return null;
    return this.products().find((product) => product.id === id) ?? null;
  });

  protected readonly metrics = computed<CatalogMetric[]>(() => {
    const list = this.rows();
    const bestsellers = list.filter((r) => r.isBestseller).length;
    const totalSold = list.reduce((a, r) => a + r.soldCount, 0);
    return [
      {
        label: 'Products',
        value: this.formatInteger(list.length),
        detail: `${this.categories().length} categories`,
        icon: 'package',
        tone: 'primary',
      },
      {
        label: 'Bestsellers',
        value: this.formatInteger(bestsellers),
        detail: 'Flagged by the seller',
        icon: 'star',
        tone: 'rose',
      },
      {
        label: 'Buyers (30 days)',
        value: this.formatInteger(totalSold),
        detail: 'Distinct paid orders per product',
        icon: 'analytics',
        tone: 'teal',
      },
    ];
  });

  protected readonly sortOptions = [
    { value: 'name:asc', label: 'Name · A to Z' },
    { value: 'name:desc', label: 'Name · Z to A' },
    { value: 'price:desc', label: 'Price · high to low' },
    { value: 'price:asc', label: 'Price · low to high' },
  ];

  protected categoryTone = categoryTone;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      const state: CatalogQueryState = {
        query: params.get('q') ?? '',
        category: (params.get('category') ?? 'all') as CatalogCategoryFilter,
        sort: (params.get('sort') ?? 'name') as CatalogSort,
        direction: (params.get('dir') ?? 'asc') as CatalogDirection,
        view: (params.get('view') ?? 'grid') as CatalogView,
      };
        this.queryState.set(state);
      this.searchDraft.set(state.query);
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (!this.isBrowser || !(event instanceof NavigationStart)) return;
      if (event.url.startsWith('/products/item/')) {
        savedY = window.scrollY;
      } else if (
        (this.router.getCurrentNavigation()?.previousNavigation?.finalUrl?.toString() ?? '').startsWith(
          '/products/item/',
        )
      ) {
        requestAnimationFrame(() => window.scrollTo(0, savedY));
      }
    });

    afterNextRender(() => this.initializeMotion());
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      this.fillObserver?.disconnect();
      this.context?.revert();
    });

    void this.loadCatalog();
  }

  protected categoryCount(categoryId: string): number {
    return this.rows().filter((r) => r.category === categoryId).length;
  }

  protected readonly openCreate = (): void => {
    this.editorProductId.set(null);
    this.editorOpen.set(true);
  };

  protected readonly openEdit = (row: CatalogRow): void => {
    this.editorProductId.set(row.id);
    this.editorOpen.set(true);
  };

  protected closeEditor(): void {
    this.editorOpen.set(false);
  }

  protected onEditorSaved(): void {
    void this.loadCatalog();
  }

  private async loadCatalog(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [productsResult, categoriesResult] = await Promise.all([
        this.catalogueApi.list({ page: 1, limit: 100 }),
        this.catalogueApi.categories(),
      ]);
      this.products.set(productsResult.data);
      this.categories.set(categoriesResult.map((c) => ({ id: c.id, name: c.name })));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load the catalog.');
    } finally {
      this.loading.set(false);
    }
  }

  protected setCategory(category: string): void {
    this.updateState({ category });
  }

  protected setView(view: CatalogView): void {
    this.updateState({ view });
  }

  protected onSearchInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.searchDraft.set(target.value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.updateState({ query: this.searchDraft() });
    }, 220);
  }

  protected clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.updateState({ query: '' });
  }

  protected clearFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.updateState({ ...DEFAULT_QUERY, view: this.queryState().view });
  }

  protected onSortChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const [sort, direction] = target.value.split(':');
    if (sort !== 'name' && sort !== 'price') return;
    if (direction !== 'asc' && direction !== 'desc') return;
    this.updateState({ sort, direction });
  }

  protected sortHeader(sort: CatalogSort): void {
    const current = this.queryState();
    const direction: CatalogDirection =
      current.sort === sort
        ? current.direction === 'asc'
          ? 'desc'
          : 'asc'
        : sort === 'price'
          ? 'desc'
          : 'asc';
    this.updateState({ sort, direction });
  }

  protected sortValue(): string {
    const state = this.queryState();
    return `${state.sort}:${state.direction}`;
  }

  protected sortLabel(): string {
    return this.sortOptions.find((option) => option.value === this.sortValue())?.label ?? 'Name · A to Z';
  }

  private updateState(patch: Partial<CatalogQueryState>): void {
    const current = this.queryState();
    if (!('query' in patch) && this.searchDraft() !== current.query) {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      patch = { ...patch, query: this.searchDraft() };
    }
    const next = { ...current, ...patch };
    if (
      next.query === current.query &&
      next.category === current.category &&
      next.sort === current.sort &&
      next.direction === current.direction &&
      next.view === current.view
    ) {
      return;
    }
    this.queryState.set(next);
    this.urlError.set('');
    this.writeQueryState(next);
    this.animateRows();
  }

  private writeQueryState(state: CatalogQueryState): void {
    const navigation = ++this.urlNavigation;
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: {
          q: state.query,
          category: state.category,
          sort: state.sort,
          dir: state.direction,
          view: state.view,
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
      .then((success) => {
        if (!success && navigation === this.urlNavigation) {
          this.urlError.set('Filters could not be saved to the URL.');
        }
      })
      .catch((error: unknown) => {
        if (navigation !== this.urlNavigation) return;
        console.error('Unable to save catalog filters to the URL.', error);
        this.urlError.set('Filters could not be saved to the URL.');
      });
  }

  private animateRows(): void {
    if (!this.isBrowser) return;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.zone.runOutsideAngular(() => {
      this.animationFrame = requestAnimationFrame(() => {
        const root = this.root()?.nativeElement;
        if (!root || !this.context) return;
        const cards = root.querySelectorAll<HTMLElement>(
          '.product-card, .catalog-table tbody tr, .catalog-empty',
        );
        this.context.add(() => {
          gsap.killTweensOf(cards);
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          gsap.fromTo(
            cards,
            { autoAlpha: 0, y: 8 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.32,
              stagger: 0.025,
              ease: 'power2.out',
              overwrite: 'auto',
            },
          );
        });
        this.observeFills(root);
      });
    });
  }

  private initializeMotion(): void {
    if (!this.isBrowser) return;
    const root = this.root()?.nativeElement;
    if (!root) return;
    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.context = gsap.context(() => {
        if (!reducedMotion) {
          gsap.from(root.querySelectorAll<HTMLElement>('[data-enter]'), {
            autoAlpha: 0,
            y: 12,
            duration: 0.58,
            stagger: 0.055,
            ease: 'power2.out',
          });
        }
      }, root);
      this.observeFills(root);
    });
  }

  private observeFills(root: HTMLElement): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fills = root.querySelectorAll<HTMLElement>('[data-share], [data-cover]');
    if (!fills.length) return;
    if (!this.fillObserver && typeof IntersectionObserver !== 'undefined') {
      this.fillObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
            this.animateFill(entry.target);
            this.fillObserver?.unobserve(entry.target);
          }
        },
        { threshold: 0.15 },
      );
    }
    for (const fill of fills) {
      if (this.observedFills.has(fill)) continue;
      this.observedFills.add(fill);
      if (this.fillObserver) this.fillObserver.observe(fill);
      else this.animateFill(fill);
    }
  }

  private animateFill(fill: HTMLElement): void {
    const value = Number(fill.dataset['share'] ?? fill.dataset['cover'] ?? 0);
    if (!Number.isFinite(value)) return;
    this.context?.add(() => {
      gsap.fromTo(
        fill,
        { scaleX: 0 },
        {
          scaleX: Math.max(0, Math.min(1, value)),
          duration: 0.8,
          ease: 'power2.out',
          overwrite: 'auto',
        },
      );
    });
  }

  private formatInteger(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
}
