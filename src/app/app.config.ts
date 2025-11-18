import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app.routes';
import { GlobalConfigService } from './service/config/global-config-service';
import { APP_INITIALIZER } from '@angular/core';
import { ToastrModule } from 'ngx-toastr';

import { provideAnimations } from '@angular/platform-browser/animations';
import { LanguageErrorInterceptor } from './Interceptors/language-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [GlobalConfigService],
      useFactory: (cfg: GlobalConfigService) => () => cfg.load(),
    },

    provideAnimations(),

    importProvidersFrom(
      ToastrModule.forRoot({
        positionClass: 'toast-bottom-right',
        timeOut: 4000,
        closeButton: true,
        progressBar: true,
        newestOnTop: true,
        tapToDismiss: true,
      })
    ),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LanguageErrorInterceptor,
      multi: true,
    },
  ],
};
