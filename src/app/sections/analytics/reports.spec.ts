import { Order } from '../../core/models';
import { Granularity, granularPoints, previousWindow, windowFor } from './reports';

function order(id: string, createdAt: number): Order {
  return {
    id,
    number: id,
    customerId: 'customer-1',
    channel: 'online',
    status: 'delivered',
    createdAt,
    shipBy: createdAt,
    locId: 'location-1',
    lines: [{ productId: 'product-1', qty: 2, price: 100 }],
    carrier: 'Local',
    paid: true,
    history: [],
  };
}

describe('analytics report windows and chart buckets', () => {
  it('calculates year-to-date length from the actual window', () => {
    const now = new Date(2026, 4, 15, 12).getTime();
    const range = { id: 'ytd', label: 'Year to date', days: 365 };
    const window = windowFor(range, now);
    expect(window.start).toBe(new Date(2026, 0, 1).getTime());
    expect(window.days).toBe(Math.ceil((now - window.start) / 86400000));
    const previous = previousWindow(window, range);
    expect(previous.start).toBe(new Date(2025, 0, 1).getTime());
    expect(previous.end).toBe(new Date(2025, 4, 15, 12).getTime());
  });

  it('uses the company fiscal start month for year-to-date windows', () => {
    const now = new Date(2026, 2, 15, 12).getTime();
    const range = { id: 'ytd', label: 'Year to date', days: 365 };
    expect(windowFor(range, now, 'April').start).toBe(new Date(2025, 3, 1).getTime());
  });

  for (const mode of ['day', 'week', 'month'] as Granularity[]) {
    it(`keeps revenue in the expected ${mode} bucket`, () => {
      const start = new Date(2026, 4, 1, 12).getTime();
      const end = new Date(2026, 4, 15, 12).getTime();
      const points = granularPoints(
        [order('order-1', new Date(2026, 4, 2, 8).getTime())],
        { start, end, days: 14 },
        mode,
      );

      expect(points.reduce((total, point) => total + point.value, 0)).toBe(200);
      expect(points.some((point) => point.value === 200)).toBeTrue();
    });
  }

  it('anchors weekly buckets to the selected week start', () => {
    const start = new Date(2026, 4, 6, 12).getTime();
    const end = new Date(2026, 4, 15, 12).getTime();
    const orders = [order('order-1', new Date(2026, 4, 10, 8).getTime())];
    const window = { start, end, days: 9 };

    const monday = granularPoints(orders, window, 'week', 'mon').find((point) => point.value > 0);
    const sunday = granularPoints(orders, window, 'week', 'sun').find((point) => point.value > 0);

    expect(monday?.label).toBe('Week of May 4');
    expect(sunday?.label).toBe('Week of May 10');
  });

  it('includes zero-value months so the YTD chart remains continuous', () => {
    const points = granularPoints(
      [order('order-1', new Date(2026, 1, 10).getTime())],
      {
        start: new Date(2026, 0, 1).getTime(),
        end: new Date(2026, 2, 20).getTime(),
        days: 79,
      },
      'month',
    );

    expect(points.map((point) => point.label)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(points.map((point) => point.value)).toEqual([0, 200, 0]);
  });
});
