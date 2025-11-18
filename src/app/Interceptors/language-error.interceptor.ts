import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { LanguageService } from '../service/lang/language.service';
import { AppToastService } from '../service/Toastr/app-toast.service';

@Injectable()
export class LanguageErrorInterceptor implements HttpInterceptor {
  private langService = inject(LanguageService);
  private toast = inject(AppToastService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const lang = this.langService.lang();

    const modified = req.clone({
      setHeaders: {
        'Accept-Language': lang,
      },
    });

    return next.handle(modified).pipe(
      catchError((error: HttpErrorResponse) => {
        const errorHeader =
          error.headers.get('X-Error-Message') || error.headers.get('X-Error-Header');

        if (errorHeader) {
          this.toast.error(errorHeader);
        } else if (error.error && typeof error.error === 'string') {
          this.toast.error(error.error);
        } else {
          this.toast.error('حدث خطأ غير متوقع');
        }

        return throwError(() => error);
      })
    );
  }
}
