import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type LedgerEntryType = 'sale' | 'investment' | 'expense' | 'purchase' | 'payroll' | 'tax';
export type LedgerReportType = 'income' | 'expenditure' | 'investment' | 'loss' | 'profit';

export interface ApiLedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: number;
  category: string | null;
  referenceId: string | null;
  recordedBy: string | null;
  entryAt: string;
}

export interface ApiLedgerList {
  data: ApiLedgerEntry[];
  total: number;
}

export interface ApiLedgerReport {
  type: LedgerReportType;
  total: number;
  period: { from: string | null; to: string | null };
  entries: ApiLedgerEntry[];
}

@Injectable({ providedIn: 'root' })
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(
    filters: { type?: LedgerEntryType; from?: string; to?: string; page: number; limit: number } = {
      page: 1,
      limit: 50,
    },
  ): Promise<ApiLedgerList> {
    let params = new HttpParams()
      .set('page', String(filters.page))
      .set('limit', String(filters.limit));
    if (filters.type) params = params.set('type', filters.type);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return firstValueFrom(
      this.http.get<ApiLedgerList>(apiUrl(this.baseUrl, 'accounting/ledger'), { params }),
    );
  }

  report(type: LedgerReportType, from?: string, to?: string): Promise<ApiLedgerReport> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return firstValueFrom(
      this.http.get<ApiLedgerReport>(
        apiUrl(this.baseUrl, `accounting/reports/${type}`),
        { params },
      ),
    );
  }
}
