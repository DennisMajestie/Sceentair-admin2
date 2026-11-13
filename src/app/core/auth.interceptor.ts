import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { ApiSession } from './api-session';
import { AuthService } from './auth.service';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/2fa/verify', '/auth/me'];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const session = inject(ApiSession);
  const injector = inject(Injector);
  const apiBase = new URL(baseUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  const requestUrl = new URL(request.url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (!requestUrl.pathname.startsWith(apiBase.pathname)) {
    return next(request);
  }

  const withAuth = (req: HttpRequest<unknown>, token = session.accessToken()) =>
    req.clone({
      withCredentials: true,
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
    });

  const redirectToSignIn = () => {
    const router = injector.get(Router);
    const url = router.url;
    if (url.startsWith('/signin')) return;
    void router.navigate(['/signin'], {
      queryParams: url && url !== '/' ? { returnUrl: url } : {},
    });
  };

  return next(withAuth(request)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        AUTH_ENDPOINTS.some((path) => requestUrl.pathname.endsWith(path))
      ) {
        return throwError(() => error);
      }
      const auth = injector.get(AuthService);
      return from(auth.refreshSession().catch(() => false)).pipe(
        switchMap((renewed) => {
          if (!renewed) {
            redirectToSignIn();
            return throwError(() => error);
          }
          return next(withAuth(request, session.accessToken())).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                redirectToSignIn();
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
