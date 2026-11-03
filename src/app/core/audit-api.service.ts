import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiAuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  beforeState: unknown | null;
  afterState: unknown | null;
  timestamp: string;
}

export interface ApiAuditList {
  data: ApiAuditEntry[];
  total: number;
}

export interface ApiAuditVerify {
  total: number;
  valid: number;
  broken: number;
  headHash: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 50, action?: string): Promise<ApiAuditList> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (action) params = params.set('action', action);
    return firstValueFrom(
      this.http.get<ApiAuditList>(apiUrl(this.baseUrl, 'audit-log'), { params }),
    );
  }

  verify(): Promise<ApiAuditVerify> {
    return firstValueFrom(
      this.http.get<ApiAuditVerify>(apiUrl(this.baseUrl, 'audit-log/verify')),
    );
  }
}
