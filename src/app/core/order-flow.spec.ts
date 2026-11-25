import { canAdvanceOrder, nextOrderStatus } from './order-flow';
import type { OrderStatus } from './models';

describe('order flow', () => {
  it('allows only the next customer-facing status', () => {
    const transitions: [OrderStatus, OrderStatus][] = [
      ['awaiting_payment', 'order_received'],
      ['order_received', 'processing'],
      ['processing', 'shipped'],
      ['shipped', 'delivered'],
    ];

    for (const [from, to] of transitions) {
      expect(nextOrderStatus(from)).toBe(to);
      expect(canAdvanceOrder(from, to)).toBeTrue();
    }
  });

  it('does not allow skipping, reversing, or advancing terminal statuses', () => {
    expect(canAdvanceOrder('order_received', 'shipped')).toBeFalse();
    expect(canAdvanceOrder('processing', 'order_received')).toBeFalse();
    expect(nextOrderStatus('delivered')).toBeUndefined();
    expect(nextOrderStatus('cancelled')).toBeUndefined();
    expect(nextOrderStatus('returned')).toBeUndefined();
  });
});
