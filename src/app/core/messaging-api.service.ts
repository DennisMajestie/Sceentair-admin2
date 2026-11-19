import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiConversation {
  id: string;
  customerId: string | null;
  customerName?: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  channel: 'in_platform' | 'whatsapp' | 'sms' | 'email';
  status: 'open' | 'pending' | 'closed';
  relatedOrderId: string | null;
  subject: string | null;
  assigneeId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadStaff: number;
  unreadCustomer: number;
  createdAt: string;
}

export interface ApiConversationMessage {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  attachmentUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ApiConversationDetail {
  conversation: ApiConversation;
  messages: ApiConversationMessage[];
}

@Injectable({ providedIn: 'root' })
export class MessagingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  unread(): Promise<{ count: number }> {
    return firstValueFrom(this.http.get<{ count: number }>(apiUrl(this.baseUrl, 'messaging/unread')));
  }

  threads(options?: {
    status?: string;
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: ApiConversation[]; total: number }> {
    let params = new HttpParams();
    if (options?.status) params = params.set('status', options.status);
    if (options?.unreadOnly) params = params.set('unreadOnly', 'true');
    if (options?.page) params = params.set('page', options.page);
    if (options?.limit) params = params.set('limit', options.limit);
    return firstValueFrom(
      this.http.get<{ data: ApiConversation[]; total: number }>(
        apiUrl(this.baseUrl, 'messaging/threads'),
        { params },
      ),
    );
  }

  detail(id: string): Promise<ApiConversationDetail> {
    return firstValueFrom(
      this.http.get<ApiConversationDetail>(
        apiUrl(this.baseUrl, `messaging/conversations/${id}`),
      ),
    );
  }

  reply(id: string, body: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl(this.baseUrl, `messaging/threads/${id}/messages`), { body }),
    );
  }

  markRead(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl(this.baseUrl, `messaging/threads/${id}/read`), {}),
    );
  }

  update(id: string, patch: { status?: string; assigneeId?: string | null }): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(apiUrl(this.baseUrl, `messaging/threads/${id}`), patch),
    );
  }
}
