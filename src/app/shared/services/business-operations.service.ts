import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BusinessOperationsService {
  private readonly _base_url = (environment as any).apiUrl;

  constructor() {}

  public boxes(id?: number) {
    return this.buildUrl('box', id);
  }

  public items(id?: number) {
    return this.buildUrl('items', id);
  }

  public checklists(id?: number) {
    return this.buildUrl('checklists', id);
  }

  public checkToken() {
    return `${this._base_url}/auth/token`;
  }

  public register() {
    return `${this._base_url}/auth/register`;
  }

  public login() {
    return `${this._base_url}/auth/login`;
  }

  public resetPassword() {
    return `${this._base_url}/auth/reset-password`;
  }

  public resetPasswordConfirm() {
    return `${this._base_url}/auth/reset-password/confirm`;
  }

  private buildUrl(entity: string, id?: number) {
    return `${this._base_url}/${entity}${id ? `/${id}` : ''}`;
  }
}
