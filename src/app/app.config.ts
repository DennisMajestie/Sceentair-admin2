import { ApplicationConfig, APP_INITIALIZER, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { Store } from './core/store';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';

function initializeApp(): () => Promise<void> {
  const auth = inject(AuthService);
  const store = inject(Store);
  return async () => {
    // Auth must settle (guard needs to know), but data bootstrap must not block
    // first paint — the dashboard mounts immediately and hydrates as data lands.
    if (await auth.restoreSession()) void store.load();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withViewTransitions()),
    { provide: APP_INITIALIZER, useFactory: initializeApp, multi: true },
  ]
};
