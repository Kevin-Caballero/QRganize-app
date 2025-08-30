export interface ChecklistItem {
  id: number;
  name: string;
  quantity: number;
  isCompleted: boolean;
  isFragile: boolean;
  expires: boolean;
  expirationDate?: Date;
  imageUrl?: string; // Added image field
  checklistId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Checklist {
  id: number;
  name: string;
  description?: string;
  userId: number;
  boxId?: number;
  items: ChecklistItem[];
  box?: {
    id: number;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChecklistDto {
  name: string;
  description?: string;
  boxId?: number;
}

export interface UpdateChecklistDto {
  name?: string;
  description?: string;
  boxId?: number;
}

export interface CreateChecklistItemDto {
  name: string;
  quantity?: number;
  isCompleted?: boolean;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
  imageData?: string; // Added for base64 image data
}

export interface UpdateChecklistItemDto {
  name?: string;
  quantity?: number;
  isCompleted?: boolean;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
  imageData?: string; // Added for base64 image data
}
