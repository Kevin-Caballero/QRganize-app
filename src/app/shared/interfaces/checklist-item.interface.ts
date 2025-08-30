export interface ChecklistItem {
  id?: number;
  name: string;
  isCompleted: boolean;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
  checklistId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateChecklistItemDto {
  name: string;
  isCompleted: boolean;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
}

export interface UpdateChecklistItemDto {
  name?: string;
  isCompleted?: boolean;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
}
