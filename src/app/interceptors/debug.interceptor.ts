import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class DebugInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    console.log(`DEBUG - HTTP Request: ${request.method} ${request.url}`);
    const startTime = Date.now();

    return next.handle(request).pipe(
      tap(
        (event) => {
          if (event instanceof HttpResponse) {
            const duration = Date.now() - startTime;
            console.log(
              `DEBUG - HTTP Response: ${request.method} ${request.url} ${event.status} (${duration}ms)`
            );
            console.log(
              'DEBUG - Response body:',
              JSON.stringify(event.body).substring(0, 500) + '...'
            );
          }
        },
        (error: HttpErrorResponse) => {
          const duration = Date.now() - startTime;
          console.error(
            `DEBUG - HTTP Error: ${request.method} ${request.url} ${error.status} (${duration}ms)`
          );
          console.error('DEBUG - Error body:', error.error);
          console.error('DEBUG - Error message:', error.message);
        }
      )
    );
  }
}
