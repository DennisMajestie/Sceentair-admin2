import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type DeliveryMethod = 'freight' | 'pickup';
export type DeliveryLegStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

export interface ApiDeliveryLeg {
  id: string;
  order_id: string;
  carrier: string;
  leg_number: number;
  status: DeliveryLegStatus;
  tracking_ref: string | null;
  weight_kg: number | null;
  zone: string | null;
  contents: unknown | null;
  checkpoints: unknown | null;
  driver_name: string | null;
  driver_phone: string | null;
  cost: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLeg {
  id: string;
  orderId: string;
  carrier: string;
  legNumber: number;
  status: DeliveryLegStatus;
  trackingRef: string | null;
  weightKg: number | null;
  zone: string | null;
  contents: unknown | null;
  checkpoints: unknown | null;
  driverName: string | null;
  driverPhone: string | null;
  cost: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdAtNum: number;
  updatedAtNum: number;
}

export interface ApiDeliveryLegList {
  data: ApiDeliveryLeg[];
  total: number;
}

export interface DeliveryLegFilters {
  page: number;
  limit: number;
  status?: DeliveryLegStatus;
}

export interface UpdateDeliveryLegStatusInput {
  status: DeliveryLegStatus;
}

export interface AddCheckpointInput {
  checkpoint: unknown;
}

function mapDeliveryLeg(l: ApiDeliveryLeg): DeliveryLeg {
  return {
    id: l.id,
    orderId: l.order_id,
    carrier: l.carrier,
    legNumber: l.leg_number,
    status: l.status,
    trackingRef: l.tracking_ref,
    weightKg: l.weight_kg,
    zone: l.zone,
    contents: l.contents,
    checkpoints: l.checkpoints,
    driverName: l.driver_name,
    driverPhone: l.driver_phone,
    cost: l.cost,
    createdBy: l.created_by,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    createdAtNum: Date.parse(l.created_at),
    updatedAtNum: Date.parse(l.updated_at),
  };
}

@Injectable({ providedIn: 'root' })
export class DeliveriesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: DeliveryLegFilters = { page: 1, limit: 50 }): Promise<DeliveryLeg[]> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.status) params = params.set('status', filters.status);
    return firstValueFrom(
      this.http.get<ApiDeliveryLegList>(apiUrl(this.baseUrl, 'deliveries'), { params }),
    ).then((r) => r.data.map(mapDeliveryLeg));
  }

  tracking(id: string): Promise<DeliveryLeg> {
    return firstValueFrom(
      this.http.get<ApiDeliveryLeg>(apiUrl(this.baseUrl, `deliveries/${encodeURIComponent(id)}/tracking`)),
    ).then(mapDeliveryLeg);
  }

  updateStatus(id: string, input: UpdateDeliveryLegStatusInput): Promise<DeliveryLeg> {
    return firstValueFrom(
      this.http.patch<ApiDeliveryLeg>(
        apiUrl(this.baseUrl, `deliveries/${encodeURIComponent(id)}/status`),
        input,
      ),
    ).then(mapDeliveryLeg);
  }

  addCheckpoint(id: string, input: AddCheckpointInput): Promise<DeliveryLeg> {
    return firstValueFrom(
      this.http.post<ApiDeliveryLeg>(
        apiUrl(this.baseUrl, `deliveries/${encodeURIComponent(id)}/checkpoint`),
        input,
      ),
    ).then(mapDeliveryLeg);
  }
}
