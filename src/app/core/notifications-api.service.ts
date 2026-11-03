import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiNotification {
  id: string;
  recipientId: string;
  channel: 'in_platform' | 'sms' | 'whatsapp';
  type: string;
  relatedOrderId: string | null;
  message: string;
  status: 'sent' | 'failed' | 'skipped';
  providerRef: string | null;
  sentAt: string;
  readAt: string | null;
}

export interface ApiNotificationList {
  data: ApiNotification[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 50): Promise<ApiNotificationList> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(
      this.http.get<ApiNotificationList>(apiUrl(this.baseUrl, 'notifications'), { params }),
    );
  }

  getPreferences(): Promise<Record<string, boolean>> {
    return firstValueFrom(
      this.http.get<Record<string, boolean>>(
        apiUrl(this.baseUrl, 'notifications/preferences'),
      ),
    );
  }

  updatePreferences(
    preferences: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    return firstValueFrom(
      this.http.patch<Record<string, boolean>>(
        apiUrl(this.baseUrl, 'notifications/preferences'),
        { preferences },
      ),
    );
  }

  markRead(id: string): Promise<{ readAt: string }> {
    return firstValueFrom(
      this.http.patch<{ readAt: string }>(
        apiUrl(this.baseUrl, `notifications/${id}/read`),
        {},
      ),
    );
  }
}
