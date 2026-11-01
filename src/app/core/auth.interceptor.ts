import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from './api-config';
import { ApiSession } from './api-session';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const session = inject(ApiSession);
  const apiBase = new URL(baseUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  const requestUrl = new URL(request.url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (!requestUrl.pathname.startsWith(apiBase.pathname)) {
    return next(request);
  }

  const token = session.accessToken();
  return next(
    request.clone({
      withCredentials: true,
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
    }),
  );
};
