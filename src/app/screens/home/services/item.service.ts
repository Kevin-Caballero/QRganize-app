import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BusinessOperationsService } from 'src/app/shared/services/business-operations.service';
import { Item, CreateItemDto } from '../models/item.interface';

@Injectable({
  providedIn: 'root',
})
export class ItemService {
  constructor(
    private httpClient: HttpClient,
    private bo: BusinessOperationsService
  ) {}

  createItem(boxId: number, data: CreateItemDto): Observable<Item> {
    return this.httpClient.post<Item>(`${this.bo.items()}/${boxId}`, data);
  }

  getItemsByBox(boxId: number): Observable<Item[]> {
    return this.httpClient.get<Item[]>(`${this.bo.items()}?boxId=${boxId}`);
  }

  getItem(id: number): Observable<Item> {
    return this.httpClient.get<Item>(`${this.bo.items()}/${id}`);
  }

  updateItem(id: number, data: Partial<CreateItemDto>): Observable<Item> {
    return this.httpClient.patch<Item>(`${this.bo.items()}/${id}`, data);
  }

  deleteItem(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.bo.items()}/${id}`);
  }
}
