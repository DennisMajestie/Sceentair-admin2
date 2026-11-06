import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type CustomOrderStatus =
  | 'submitted'
  | 'under_review'
  | 'quoted'
  | 'quote_accepted'
  | 'paid'
  | 'sample_in_production'
  | 'sample_approved'
  | 'in_production'
  | 'fulfilled'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

export interface ApiCustomOrderBuyer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: { name: string } | null;
}

export interface ApiCustomOrderRequest {
  id: string;
  buyer: ApiCustomOrderBuyer;
  sizes: string;
  colours: string;
  quantity: number;
  location: string;
  fabricQuality: string;
  description: string;
  desiredDate: string;
  status: CustomOrderStatus;
  reviewNote: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCustomOrderList {
  data: ApiCustomOrderRequest[];
  total: number;
}

export interface ApiQuotation {
  id: string;
  request?: ApiCustomOrderRequest;
  amount: number;
  note: string | null;
  approvedBy: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CustomOrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 100): Promise<ApiCustomOrderList> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(
      this.http.get<ApiCustomOrderList>(apiUrl(this.baseUrl, 'custom-orders'), { params }),
    );
  }

  detail(id: string): Promise<ApiCustomOrderRequest> {
    return firstValueFrom(
      this.http.get<ApiCustomOrderRequest>(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}`),
      ),
    );
  }

  quotation(id: string): Promise<ApiQuotation> {
    return firstValueFrom(
      this.http.get<ApiQuotation>(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}/quotation`),
      ),
    );
  }

  sendQuotation(id: string, input: { amount: number; note?: string }): Promise<ApiQuotation> {
    return firstValueFrom(
      this.http.post<ApiQuotation>(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}/quotation`),
        input,
      ),
    );
  }

  recordPayment(id: string, input: { method: 'paystack' | 'cash' | 'pos' | 'bank_transfer'; amount: number }): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}/payment`),
        input,
      ),
    );
  }

  recordSampleDecision(id: string, input: { approved: boolean; note?: string }): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}/sample-approval`),
        input,
      ),
    );
  }

  updateStatus(id: string, input: { status: CustomOrderStatus; note?: string }): Promise<ApiCustomOrderRequest> {
    return firstValueFrom(
      this.http.patch<ApiCustomOrderRequest>(
        apiUrl(this.baseUrl, `custom-orders/${encodeURIComponent(id)}/status`),
        input,
      ),
    );
  }
}
