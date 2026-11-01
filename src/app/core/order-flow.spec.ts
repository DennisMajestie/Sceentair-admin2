import { canAdvanceOrder, nextOrderStatus } from './order-flow';
import type { OrderStatus } from './models';

describe('order flow', () => {
  it('allows only the next fulfillment step', () => {
    const transitions: [OrderStatus, OrderStatus][] = [
      ['new', 'picking'],
      ['picking', 'packed'],
      ['packed', 'shipped'],
      ['shipped', 'delivered'],
    ];

    for (const [from, to] of transitions) {
      expect(nextOrderStatus(from)).toBe(to);
      expect(canAdvanceOrder(from, to)).toBeTrue();
    }
  });

  it('does not allow skipping, reversing, or advancing terminal statuses', () => {
    expect(canAdvanceOrder('new', 'packed')).toBeFalse();
    expect(canAdvanceOrder('packed', 'picking')).toBeFalse();
    expect(nextOrderStatus('delivered')).toBeUndefined();
    expect(nextOrderStatus('cancelled')).toBeUndefined();
  });
});
