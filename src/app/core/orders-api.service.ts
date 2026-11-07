import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type ApiOrderStatus =
  | 'awaiting_payment'
  | 'order_received'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'stock_exception'
  | 'cancelled';

export type ApiOrderChannel = 'retail' | 'wholesale' | 'custom' | 'in_store';
export type ApiPaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface ApiOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  shortfall?: number;
  variant: {
    id: string;
    sku: string;
    size: string | null;
    colour: string | null;
    imageUrl?: string | null;
    product?: {
      id: string;
      name: string;
      primaryImageUrl: string | null;
    };
  };
}

export interface ApiOrder {
  id: string;
  customer: { id: string; name: string; email: string; phone?: string | null } | null;
  guestName: string | null;
  guestEmail: string | null;
  channel: ApiOrderChannel;
  source: string | null;
  status: ApiOrderStatus;
  paymentStatus: ApiPaymentStatus;
  totalAmount: number;
  deliveryFee?: number | null;
  shippingAddress: {
    state: string;
    city: string;
    line: string;
    phone: string;
    landmark?: string;
  } | null;
  deliveryMethod: 'freight' | 'pickup' | null;
  deliveredAt: string | null;
  items: ApiOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiOrderList {
  data: ApiOrder[];
  total: number;
}

export interface ApiPublicConfig {
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  serverNow: string;
}

export interface ApiOrderFilters {
  page: number;
  limit: number;
  channel?: ApiOrderChannel;
  status?: ApiOrderStatus;
}

export interface ApiTracking {
  status: ApiOrderStatus | 'awaiting_stock';
  deliveredAt: string | null;
  events: Array<{
    status: string;
    note?: string | null;
    actor?: string | null;
    createdAt: string;
  }>;
  deliveries: Array<{
    legNumber: number;
    carrier: string;
    status: string;
    trackingRef: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
    cost?: number | null;
    checkpoints?: Array<{
      zone?: unknown;
      status?: string | null;
      note?: string | null;
      at?: string | null;
    }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiOrderFilters): Promise<ApiOrderList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.channel) params = params.set('channel', filters.channel);
    if (filters.status) params = params.set('status', filters.status);
    return firstValueFrom(
      this.http.get<ApiOrderList>(apiUrl(this.baseUrl, 'orders'), { params }),
    );
  }

  publicConfig(): Promise<ApiPublicConfig> {
    return firstValueFrom(
      this.http.get<ApiPublicConfig>(apiUrl(this.baseUrl, 'config/public')),
    );
  }

  detail(id: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.http.get<ApiOrder>(apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}`)),
    );
  }

  tracking(id: string): Promise<ApiTracking> {
    return firstValueFrom(
      this.http.get<ApiTracking>(apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}/tracking`)),
    );
  }

  updateStatus(id: string, status: ApiOrderStatus): Promise<ApiOrder> {
    return firstValueFrom(
      this.http.patch<ApiOrder>(apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}/status`), {
        status,
      }),
    );
  }

  /** Stock exception: retry the short lines against current stock. */
  allocateStockException(id: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.http.post<ApiOrder>(
        apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}/stock-exception/allocate`),
        {},
      ),
    );
  }

  /** Stock exception: release allocated units, record the refund, cancel the order. */
  refundStockException(id: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.http.post<ApiOrder>(
        apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}/stock-exception/refund`),
        {},
      ),
    );
  }

  /** Warehouse pack-out for dispatch: shipping address, weight, pallet, QR stencil. */
  fulfil(
    id: string,
    body: Record<string, unknown>,
  ): Promise<ApiOrder> {
    return firstValueFrom(
      this.http.patch<ApiOrder>(
        apiUrl(this.baseUrl, `orders/${encodeURIComponent(id)}/fulfilment`),
        body,
      ),
    );
  }
}
