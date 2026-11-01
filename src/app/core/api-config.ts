import { InjectionToken } from '@angular/core';

declare global {
  interface Window {
    VESSA_CONFIG?: {
      apiBaseUrl?: string;
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

export function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
