import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiArticle {
  id: string;
  title: string;
  blurb: string | null;
  content: string | null;
  source: string | null;
  keywords: string[];
}

export interface ApiArticleList {
  data: ApiArticle[];
  total: number;
}

export interface ApiTicket {
  id: string;
  number: string;
  subject: string;
  body: string;
  reply: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  actorId: string | null;
}

export interface ApiTicketList {
  data: ApiTicket[];
  total: number;
}

export interface ApiTicketFilters {
  page: number;
  limit: number;
  status?: 'open' | 'in_progress' | 'resolved';
}

export interface CreateTicketRequest {
  subject: string;
  body: string;
}

export interface UpdateTicketStatusRequest {
  status: 'open' | 'in_progress' | 'resolved';
}

@Injectable({ providedIn: 'root' })
export class HelpApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  articles(): Promise<ApiArticleList> {
    return firstValueFrom(
      this.http.get<ApiArticleList>(apiUrl(this.baseUrl, 'help/articles')),
    );
  }

  tickets(filters: ApiTicketFilters = { page: 1, limit: 50 }): Promise<ApiTicketList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.status) params = params.set('status', filters.status);
    return firstValueFrom(
      this.http.get<ApiTicketList>(apiUrl(this.baseUrl, 'help/tickets'), { params }),
    );
  }

  createTicket(request: CreateTicketRequest): Promise<ApiTicket> {
    return firstValueFrom(
      this.http.post<ApiTicket>(apiUrl(this.baseUrl, 'help/tickets'), request),
    );
  }

  updateTicketStatus(id: string, request: UpdateTicketStatusRequest): Promise<ApiTicket> {
    return firstValueFrom(
      this.http.patch<ApiTicket>(
        apiUrl(this.baseUrl, `help/tickets/${encodeURIComponent(id)}/status`),
        request,
      ),
    );
  }
}
