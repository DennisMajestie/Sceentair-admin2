import type { OrderStatus } from './models';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: 'picking',
  picking: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
};

export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  return NEXT_STATUS[status];
}

export function canAdvanceOrder(from: OrderStatus, to: OrderStatus): boolean {
  return nextOrderStatus(from) === to;
}
