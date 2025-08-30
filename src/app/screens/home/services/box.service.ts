import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Box } from '../models/box.interface';
import { BusinessOperationsService } from 'src/app/shared/services/business-operations.service';
import { PaginationOptions } from 'src/app/shared/models/pagination-options';
import { BoxReqDto } from '../models/box-req.dto';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BoxService {
  constructor(
    private httpClient: HttpClient,
    private bo: BusinessOperationsService
  ) {}

  createBox(data: BoxReqDto) {
    return this.httpClient.post<Box>(this.bo.boxes(), data);
  }

  getBoxes(paginationOptions: PaginationOptions = { page: 1, size: 20 }) {
    return this.httpClient.get<unknown[]>(
      `${this.bo.boxes()}?page=${paginationOptions.page}&size=${
        paginationOptions.size
      }`
    );
  }

  deleteBox(box: Box) {
    return this.httpClient.delete(`${this.bo.boxes()}/${box.id}`);
  }

  searchBoxes(term: string) {
    return this.httpClient.get<Box[]>(
      `${this.bo.boxes()}/search/${encodeURIComponent(term)}`
    );
  }

  updateBox(boxId: number, data: BoxReqDto) {
    // Filtrar campos vacíos o undefined para no enviarlos al backend
    const cleanData: Partial<BoxReqDto> = {};
    if (data.name !== undefined && data.name !== null)
      cleanData.name = data.name;
    if (data.description !== undefined)
      cleanData.description = data.description;

    // Solo enviamos la imagen si realmente es una nueva imagen
    if (data.image && data.image.trim() !== '') {
      cleanData.image = data.image;
    } else {
      // Si no hay una nueva imagen, enviamos null explícitamente para indicar al backend
      // que no debe actualizar la imagen
      cleanData.image = null;
    }

    if (data.checklistId !== undefined)
      cleanData.checklistId = data.checklistId;

    return this.httpClient.patch<Box>(`${this.bo.boxes()}/${boxId}`, cleanData);
  }

  getAvailableForChecklist() {
    return this.httpClient.get<Box[]>(
      `${this.bo.boxes()}/available-for-checklist`
    );
  }
}
