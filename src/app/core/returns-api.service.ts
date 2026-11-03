import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';
import { ApiVariant } from './production-api.service';

export interface ApiReturnOrder {
  id: string;
  customer?: { id: string; name: string } | null;
  items?: Array<{ variant: ApiVariant; quantity: number; unitPrice: number }>;
}

export interface ApiReturn {
  id: string;
  order: ApiReturnOrder;
  variant: ApiVariant;
  quantity: number;
  refundAmount: number | null;
  photoUrls: string[] | null;
  bayTag: string | null;
  reason: string;
  requestedAt: string;
  returnDeadline: string;
  trackingNumber: string | null;
  status: 'requested' | 'resolved' | 'rejected';
  resolution: string | null;
  restocked: boolean;
  damaged: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface ApiReturnList {
  data: ApiReturn[];
  total: number;
}

export interface ResolveReturnInput {
  decision: 'resolved' | 'rejected';
  resolution: string;
  restocked?: boolean;
  damaged?: boolean;
  trackingNumber?: string;
  photoUrls?: string[];
  bayTag?: string;
}

@Injectable({ providedIn: 'root' })
export class ReturnsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 50): Promise<ApiReturnList> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(
      this.http.get<ApiReturnList>(apiUrl(this.baseUrl, 'returns'), { params }),
    );
  }

  resolve(id: string, input: ResolveReturnInput): Promise<ApiReturn> {
    return firstValueFrom(
      this.http.patch<ApiReturn>(
        apiUrl(this.baseUrl, `returns/${encodeURIComponent(id)}/resolve`),
        input,
      ),
    );
  }
}
