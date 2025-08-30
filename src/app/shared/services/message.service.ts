import { Injectable } from '@angular/core';
import { EntityType } from '../models/entity-type.enum';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  constructor() {}

  success(
    action: 'created' | 'added' | 'updated' | 'deleted',
    entity: EntityType,
    data?: string | number,
    plural = false
  ): string {
    return `${entity}${plural ? 's' : ''} '${
      data ? data : ''
    }' ${action} successfully`;
  }
  create(entity: EntityType, data: string | number, plural?: boolean): string {
    return this.success('created', entity, data, plural);
  }

  add(entity: EntityType, data: string | number, plural?: boolean): string {
    return this.success('added', entity, data, plural);
  }

  update(entity: EntityType, data: string | number, plural?: boolean): string {
    return this.success('updated', entity, data, plural);
  }

  delete(entity: EntityType, data: string | number, plural?: boolean): string {
    return this.success('deleted', entity, data, plural);
  }
}
