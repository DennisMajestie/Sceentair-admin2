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
    if (await auth.restoreSession()) await store.load();
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
