import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { from, Observable, switchMap, mergeMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptor implements HttpInterceptor {
  private storageReady: Promise<Storage>;

  constructor(private storage: Storage) {
    this.storageReady = this.initStorage();
  }

  private async initStorage(): Promise<Storage> {
    return await this.storage.create();
  }

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    console.log(
      'DEBUG - AUTH INTERCEPTOR - Processing request to:',
      request.url
    );

    // Agregar cabeceras comunes para todas las peticiones
    let modifiedRequest = request.clone({
      setHeaders: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*', // Esto es solo para depuración
      },
    });

    if (
      request.url.includes('/auth/login') ||
      request.url.includes('/auth/register')
    ) {
      console.log(
        'DEBUG - AUTH INTERCEPTOR - Auth endpoint detected, proceeding without token'
      );
      return next.handle(modifiedRequest);
    }

    return from(this.storageReady).pipe(
      mergeMap((storage) => {
        console.log('DEBUG - AUTH INTERCEPTOR - Storage ready, getting token');
        return storage.get('accessToken');
      }),
      switchMap((token) => {
        console.log(
          'DEBUG - AUTH INTERCEPTOR - Token retrieved:',
          token ? 'Present' : 'Not present'
        );

        if (token) {
          modifiedRequest = modifiedRequest.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
            },
          });
          console.log('DEBUG - AUTH INTERCEPTOR - Added Authorization header');
        } else {
          console.log('DEBUG - AUTH INTERCEPTOR - No token available');
        }

        return next.handle(modifiedRequest);
      })
    );
  }
}
