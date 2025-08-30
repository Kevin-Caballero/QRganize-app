import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BusinessOperationsService } from './business-operations.service';
import {
  Checklist,
  ChecklistItem,
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from '../interfaces/checklist.interface';

@Injectable({
  providedIn: 'root',
})
export class ChecklistService {
  constructor(
    private http: HttpClient,
    private bo: BusinessOperationsService
  ) {}

  // Checklist CRUD operations
  createChecklist(checklist: CreateChecklistDto): Observable<Checklist> {
    return this.http.post<Checklist>(this.bo.checklists(), checklist);
  }

  getChecklists(): Observable<Checklist[]> {
    return this.http.get<Checklist[]>(this.bo.checklists());
  }

  getChecklist(id: number): Observable<Checklist> {
    return this.http.get<Checklist>(this.bo.checklists(id));
  }

  updateChecklist(
    id: number,
    checklist: UpdateChecklistDto
  ): Observable<Checklist> {
    return this.http.put<Checklist>(this.bo.checklists(id), checklist);
  }

  deleteChecklist(id: number): Observable<void> {
    return this.http.delete<void>(this.bo.checklists(id));
  }

  assignToBox(checklistId: number, boxId: number): Observable<Checklist> {
    return this.http.put<Checklist>(
      `${this.bo.checklists(checklistId)}/assign-box/${boxId}`,
      {}
    );
  }

  unassignFromBox(checklistId: number): Observable<Checklist> {
    return this.http.put<Checklist>(
      `${this.bo.checklists(checklistId)}/unassign-box`,
      {}
    );
  }

  // Get checklist by boxId
  getChecklistByBoxId(boxId: number): Observable<Checklist> {
    return this.http
      .get<Checklist[]>(this.bo.checklists())
      .pipe(
        map((checklists) =>
          checklists.find((checklist) => checklist.boxId === boxId)
        )
      );
  }

  // Checklist items operations
  addItem(
    checklistId: number,
    item: CreateChecklistItemDto
  ): Observable<ChecklistItem> {
    return this.http.post<ChecklistItem>(
      `${this.bo.checklists(checklistId)}/items`,
      item
    );
  }

  updateItem(
    itemId: number,
    item: UpdateChecklistItemDto
  ): Observable<ChecklistItem> {
    return this.http.put<ChecklistItem>(
      `${this.bo.checklists()}/items/${itemId}`,
      item
    );
  }

  deleteItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.bo.checklists()}/items/${itemId}`);
  }

  toggleItemCompletion(itemId: number): Observable<ChecklistItem> {
    return this.http.put<ChecklistItem>(
      `${this.bo.checklists()}/items/${itemId}/toggle`,
      {}
    );
  }
}
