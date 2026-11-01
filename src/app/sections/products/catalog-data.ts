import { Location, Move, Order, Product } from '../../core/models';
import { coverDays, dailySales, rowShares } from './prod-shared';

export const COVER_GOOD_DAYS = 30;
export const COVER_WARN_DAYS = 14;
export const COVER_MAX_DAYS = 90;
export const CATALOG_SALES_WINDOW_DAYS = 30;

export type CatalogSort = 'name' | 'stock' | 'cover' | 'price';
export type CatalogView = 'grid' | 'list';
export type CatalogCategoryFilter = 'all' | string;
export type CatalogDirection = 'asc' | 'desc';

export interface CatalogCategory {
  id: string;
  label: string;
  count: number;
  color: string;
}

export interface CatalogLocationRow {
  id: string;
  name: string;
  units: number;
  reserved: number;
  available: number;
  share: number;
}

export interface CatalogProductRow {
  product: Product;
  onHand: number;
  reserved: number;
  available: number;
  hasReorderPoint: boolean;
  low: boolean;
  out: boolean;
  salesPerDay: number;
  coverDays: number | null;
  locations: CatalogLocationRow[];
}

export interface CatalogQueryState {
  query: string;
  category: CatalogCategoryFilter;
  lowOnly: boolean;
  sort: CatalogSort;
  direction: CatalogDirection;
  view: CatalogView;
}

const CATEGORY_COLORS = [
  'var(--primary)',
  'var(--ocean)',
  'var(--teal)',
  'var(--sage)',
  'var(--ochre)',
  'var(--rose)',
  'var(--sky)',
  'var(--slate)',
];

const LOCATION_COLORS = [
  'var(--primary)',
  'var(--ocean)',
  'var(--teal)',
  'var(--sage)',
  'var(--ochre)',
  'var(--rose)',
  'var(--sky)',
  'var(--slate)',
];

const SORTS: readonly CatalogSort[] = ['name', 'stock', 'cover', 'price'];

function isCatalogSort(value: string | null | undefined): value is CatalogSort {
  return SORTS.some((sort) => sort === value);
}

export function categoryId(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function categoryColor(value: string): string {
  let hash = 0;
  for (const char of categoryId(value)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export function catalogStockLabel(row: CatalogProductRow): string {
  if (row.out) return 'Out of stock';
  if (row.low) return 'Low stock';
  return 'In stock';
}

export function catalogStockTone(row: CatalogProductRow): 'bad' | 'warn' | 'good' {
  if (row.out) return 'bad';
  if (row.low) return 'warn';
  return 'good';
}

export function catalogCoverTone(row: CatalogProductRow): 'is-low' | 'is-watch' | 'is-healthy' | 'is-muted' {
  if (row.coverDays === null) return 'is-muted';
  if (row.coverDays <= COVER_WARN_DAYS) return 'is-low';
  if (row.coverDays <= COVER_GOOD_DAYS) return 'is-watch';
  return 'is-healthy';
}

export function catalogCoverPercent(row: CatalogProductRow): number {
  if (row.coverDays === null) return 0;
  return Math.max(0, Math.min(1, row.coverDays / COVER_MAX_DAYS));
}

export function catalogLocationColor(index: number): string {
  return LOCATION_COLORS[index % LOCATION_COLORS.length];
}

export function buildCategoryFilters(
  products: readonly Pick<Product, 'category'>[],
): CatalogCategory[] {
  const categories = new Map<string, CatalogCategory>();
  for (const product of products) {
    const label = product.category.trim();
    const id = categoryId(label);
    if (!id) continue;
    const existing = categories.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      categories.set(id, { id, label, count: 1, color: categoryColor(label) });
    }
  }
  return [...categories.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function buildCatalogRows(
  products: readonly Product[],
  locations: readonly Pick<Location, 'id' | 'name'>[],
  openOrders: readonly Pick<Order, 'locId' | 'lines'>[],
  moves: readonly Pick<Move, 'at' | 'itemId' | 'qty' | 'kind'>[],
  now: number,
): CatalogProductRow[] {
  const reservedByProduct = new Map<string, number>();
  const reservedByLocation = new Map<string, number>();

  for (const order of openOrders) {
    for (const line of order.lines) {
      reservedByProduct.set(
        line.productId,
        (reservedByProduct.get(line.productId) ?? 0) + line.qty,
      );
      const locationKey = `${line.productId}:${order.locId}`;
      reservedByLocation.set(locationKey, (reservedByLocation.get(locationKey) ?? 0) + line.qty);
    }
  }

  return products.map((product) => {
    const onHand = Object.values(product.stock).reduce((total, units) => total + units, 0);
    const reserved = reservedByProduct.get(product.id) ?? 0;
    const available = Math.max(0, onHand - reserved);
    const hasReorderPoint =
      typeof product.reorderAt === 'number' && Number.isFinite(product.reorderAt);
    const sales = dailySales(moves, product.id, CATALOG_SALES_WINDOW_DAYS, now);
    const locationRows = locations.map((location) => {
      const units = product.stock[location.id] ?? 0;
      const locationReserved = reservedByLocation.get(`${product.id}:${location.id}`) ?? 0;
      return {
        id: location.id,
        name: location.name,
        units,
        reserved: locationReserved,
        available: Math.max(0, units - locationReserved),
        share: 0,
      };
    });
    const shares = rowShares(locationRows.map((row) => row.units));

    return {
      product,
      onHand,
      reserved,
      available,
      hasReorderPoint,
      low: hasReorderPoint && available <= product.reorderAt,
      out: available <= 0,
      salesPerDay: sales.ratePerDay,
      coverDays: coverDays(available, sales.ratePerDay),
      locations: locationRows.map((row, index) => ({ ...row, share: shares[index] })),
    };
  });
}

export function filterAndSortCatalog(
  rows: readonly CatalogProductRow[],
  state: CatalogQueryState,
): CatalogProductRow[] {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (state.category !== 'all' && categoryId(row.product.category) !== state.category) {
      return false;
    }
    if (state.lowOnly && !row.low) return false;
    if (!query) return true;
    const product = row.product;
    return `${product.name} ${product.sku} ${product.barcode} ${product.line} ${product.category}`
      .toLocaleLowerCase()
      .includes(query);
  });

  return filtered.sort((left, right) => {
    let result = 0;
    if (state.sort === 'name') {
      result = left.product.name.localeCompare(right.product.name, undefined, {
        sensitivity: 'base',
      });
    } else if (state.sort === 'stock') {
      result = left.available - right.available;
    } else if (state.sort === 'price') {
      result = left.product.price - right.product.price;
    } else {
      if (left.coverDays === null && right.coverDays !== null) return 1;
      if (right.coverDays === null && left.coverDays !== null) return -1;
      if (left.coverDays === null && right.coverDays === null) {
        return left.product.name.localeCompare(right.product.name, undefined, {
          sensitivity: 'base',
        });
      } else {
        result = (left.coverDays ?? 0) - (right.coverDays ?? 0);
      }
    }
    return state.direction === 'asc' ? result : -result;
  });
}

export function parseCatalogQueryState(
  params: Readonly<Record<string, string | null | undefined>>,
): CatalogQueryState {
  const sort = params['sort'];
  const direction = params['dir'];
  const view = params['view'];
  const category = categoryId(params['category'] ?? '');
  return {
    query: params['q'] ?? '',
    category: category || 'all',
    lowOnly: params['low'] === '1',
    sort: isCatalogSort(sort) ? sort : 'name',
    direction: direction === 'desc' ? 'desc' : 'asc',
    view: view === 'list' ? 'list' : 'grid',
  };
}

export function catalogQueryParams(
  state: CatalogQueryState,
): Record<string, string | null> {
  return {
    q: state.query || null,
    category: state.category === 'all' ? null : state.category,
    low: state.lowOnly ? '1' : null,
    sort: state.sort === 'name' ? null : state.sort,
    dir: state.direction === 'asc' ? null : state.direction,
    view: state.view === 'grid' ? null : state.view,
  };
}
