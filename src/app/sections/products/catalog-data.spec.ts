import { Product } from '../../core/models';
import {
  buildCatalogRows,
  buildCategoryFilters,
  catalogQueryParams,
  CatalogQueryState,
  categoryColor,
  filterAndSortCatalog,
  parseCatalogQueryState,
} from './catalog-data';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    sku: 'SKU-001',
    name: 'Daily Serum',
    line: 'Daily',
    size: '30 ml',
    category: 'Treat',
    photo: 'serum',
    price: 25,
    wholesale: 18,
    cost: 9,
    reorderAt: 5,
    reorderQty: 12,
    bin: 'A-01',
    shelfMonths: 24,
    active: true,
    barcode: '100000000001',
    bom: [],
    blurb: 'A sample product description.',
    stock: { north: 8, south: 4 },
    ...overrides,
  };
}

const defaultState: CatalogQueryState = {
  query: '',
  category: 'all',
  lowOnly: false,
  sort: 'name',
  direction: 'asc',
  view: 'grid',
};

describe('Catalog data helpers', () => {
  it('normalizes category names, counts products, and omits blank categories', () => {
    const categories = buildCategoryFilters([
      { category: ' Treat ' },
      { category: 'treat' },
      { category: 'Body' },
      { category: '   ' },
    ]);

    expect(categories.map(({ id, label, count }) => ({ id, label, count }))).toEqual([
      { id: 'body', label: 'Body', count: 1 },
      { id: 'treat', label: 'Treat', count: 2 },
    ]);
    expect(categories[1].color).toBe(categoryColor('treat'));
  });

  it('derives available, low, out, cover, and per-location shares from real stock and orders', () => {
    const now = Date.UTC(2026, 9, 25, 12);
    const products = [
      product({ id: 'low', sku: 'LOW-1', name: 'A Serum', stock: { north: 4, south: 6 }, reorderAt: 8 }),
      product({ id: 'out', sku: 'OUT-1', name: 'B Balm', stock: { north: 2, south: 0 }, reorderAt: 3 }),
      product({ id: 'healthy', sku: 'OK-1', name: 'C Oil', stock: { north: 10, south: 5 }, reorderAt: 2 }),
      product({ id: 'no-reorder', sku: 'NR-1', name: 'D Gel', reorderAt: Number.NaN }),
    ];
    const rows = buildCatalogRows(
      products,
      [
        { id: 'north', name: 'North' },
        { id: 'south', name: 'South' },
      ],
      [
        {
          locId: 'north',
          lines: [
            { productId: 'low', qty: 3, price: 20 },
            { productId: 'out', qty: 2, price: 20 },
          ],
        },
      ],
      [{ at: now - 86_400_000, itemId: 'low', qty: -6, kind: 'sale' }],
      now,
    );
    const low = rows.find((row) => row.product.id === 'low');
    const out = rows.find((row) => row.product.id === 'out');
    const noReorder = rows.find((row) => row.product.id === 'no-reorder');

    expect(low).toEqual(
      jasmine.objectContaining({
        onHand: 10,
        reserved: 3,
        available: 7,
        hasReorderPoint: true,
        low: true,
        out: false,
        salesPerDay: 0.2,
        coverDays: 35,
      }),
    );
    expect(low?.locations.map(({ available, share }) => ({ available, share }))).toEqual([
      { available: 1, share: 0.4 },
      { available: 6, share: 0.6 },
    ]);
    expect(out).toEqual(
      jasmine.objectContaining({
        available: 0,
        low: true,
        out: true,
      }),
    );
    expect(noReorder?.hasReorderPoint).toBeFalse();
    expect(noReorder?.low).toBeFalse();
    expect(noReorder?.coverDays).toBeNull();
  });

  it('filters by normalized category, low stock, and case-insensitive product fields', () => {
    const rows = buildCatalogRows(
      [
        product({ id: 'low', name: 'Hydrating Serum', category: 'Treat', barcode: 'SERUM-ABC', stock: { north: 2, south: 0 }, reorderAt: 4 }),
        product({ id: 'healthy', name: 'Daily Balm', category: 'Body', sku: 'BALM-1', stock: { north: 20, south: 0 }, reorderAt: 4 }),
      ],
      [],
      [],
      [],
      Date.UTC(2026, 9, 25),
    );

    expect(
      filterAndSortCatalog(rows, { ...defaultState, category: 'treat' }).map((row) => row.product.id),
    ).toEqual(['low']);
    expect(
      filterAndSortCatalog(rows, { ...defaultState, lowOnly: true }).map((row) => row.product.id),
    ).toEqual(['low']);
    expect(
      filterAndSortCatalog(rows, { ...defaultState, query: 'serum-abc' }).map((row) => row.product.id),
    ).toEqual(['low']);
  });

  it('sorts by available units and keeps products without a sales pace last for either direction', () => {
    const rows = buildCatalogRows(
      [
        product({ id: 'paced', name: 'A Serum', stock: { north: 10, south: 0 }, price: 30 }),
        product({ id: 'zero', name: 'B Balm', stock: { north: 2, south: 0 }, price: 20 }),
        product({ id: 'no-sales', name: 'C Oil', stock: { north: 8, south: 0 }, price: 10 }),
      ],
      [],
      [],
      [{ at: Date.UTC(2026, 9, 24), itemId: 'paced', qty: -2, kind: 'sale' }],
      Date.UTC(2026, 9, 25),
    );

    expect(
      filterAndSortCatalog(rows, { ...defaultState, sort: 'stock' }).map((row) => row.product.id),
    ).toEqual(['zero', 'no-sales', 'paced']);
    expect(
      filterAndSortCatalog(rows, { ...defaultState, sort: 'cover', direction: 'desc' }).map(
        (row) => row.product.id,
      ),
    ).toEqual(['paced', 'zero', 'no-sales']);
  });

  it('parses and serializes URL filters while rejecting unknown enum values', () => {
    const state = parseCatalogQueryState({
      q: '  serum  ',
      category: 'Treat',
      low: '1',
      sort: 'cover',
      dir: 'desc',
      view: 'list',
    });
    expect(state).toEqual({
      query: '  serum  ',
      category: 'treat',
      lowOnly: true,
      sort: 'cover',
      direction: 'desc',
      view: 'list',
    });
    expect(
      parseCatalogQueryState({
        q: null,
        category: null,
        low: 'true',
        sort: 'unsupported',
        dir: 'up',
        view: 'table',
      }),
    ).toEqual(defaultState);
    expect(parseCatalogQueryState(catalogQueryParams(state))).toEqual(state);
  });
});
