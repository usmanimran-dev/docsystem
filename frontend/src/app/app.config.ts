import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { FormsModule } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

export const appConfig: ApplicationConfig = {
  providers: [
    // 'reload' so clicking a sidebar link back to the route you're already
    // on (e.g. "Create Document Type" after opening a record from Inquiries)
    // actually re-runs navigation instead of being silently ignored.
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(
      FormsModule,
      MatInputModule,
      MatButtonModule,
      MatCardModule
    ),
    // Material reserves a fixed line of space under every field for
    // hint/error text, even when there is none — this is what makes forms
    // look unusually tall. "dynamic" only takes that space when needed.
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { subscriptSizing: 'dynamic' }
    },
  ],
};
