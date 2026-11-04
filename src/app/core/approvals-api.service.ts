import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type ApprovalActionType = 'purchasing' | 'production_start' | 'price_change' | 'fund_movement' | 'stock_disposal';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalDecision = 'approved' | 'rejected';

export interface ApiApproval {
  id: string;
  actionType: ApprovalActionType;
  payload: Record<string, unknown> | null;
  requestedBy: string | null;
  status: ApprovalStatus;
  approvedBy: string | null;
  justification: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export type Approval = ApiApproval;

export interface ApiApprovalList {
  data: ApiApproval[];
  total: number;
}

export interface ApprovalFilters {
  page: number;
  limit: number;
  status?: ApprovalStatus;
  actionType?: ApprovalActionType;
}

export interface DecideApprovalInput {
  decision: ApprovalDecision;
  resolution: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApprovalFilters = { page: 1, limit: 50 }): Promise<ApiApprovalList> {
    let params = new HttpParams()
      .set('page', String(filters.page))
      .set('limit', String(filters.limit));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.actionType) params = params.set('actionType', filters.actionType);
    return firstValueFrom(
      this.http.get<ApiApprovalList>(apiUrl(this.baseUrl, 'approvals'), { params }),
    );
  }

  pending(): Promise<ApiApprovalList> {
    return firstValueFrom(
      this.http.get<ApiApprovalList>(apiUrl(this.baseUrl, 'approvals/pending')),
    );
  }

  create(
    dto: { actionType: ApprovalActionType; payload?: Record<string, unknown>; justification?: string },
  ): Promise<ApiApproval> {
    return firstValueFrom(
      this.http.post<ApiApproval>(apiUrl(this.baseUrl, 'approvals'), dto),
    );
  }

  decide(id: string, input: DecideApprovalInput): Promise<ApiApproval> {
    return firstValueFrom(
      this.http.post<ApiApproval>(
        apiUrl(this.baseUrl, `approvals/${encodeURIComponent(id)}/decide`),
        input,
      ),
    );
  }
}
