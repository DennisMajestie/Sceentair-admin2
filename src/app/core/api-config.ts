import { InjectionToken } from '@angular/core';

declare global {
  interface Window {
    VESSA_CONFIG?: {
      apiBaseUrl?: string;
      realtimeUrl?: string;
    };
  }
}

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    if (typeof window === 'undefined') return '/api/v1';
    return window.VESSA_CONFIG?.apiBaseUrl?.replace(/\/+$/, '') || '/api/v1';
  },
});

/**
 * Origin of the realtime (socket.io) server. Plain HTTP can ride a same-origin
 * proxy (dev proxy, Vercel rewrites) so the refresh cookie stays first-party,
 * but the websocket upgrade connects to the API origin directly. Empty means
 * "derive from apiBaseUrl".
 */
export const REALTIME_URL = new InjectionToken<string>('REALTIME_URL', {
  providedIn: 'root',
  factory: () => {
    if (typeof window === 'undefined') return '';
    return window.VESSA_CONFIG?.realtimeUrl?.replace(/\/+$/, '') || '';
  },
});

export function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
