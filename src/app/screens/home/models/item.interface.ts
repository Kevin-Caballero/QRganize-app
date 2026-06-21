export interface Item {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity?: number;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
  createdAt: Date;
}

export interface CreateItemDto {
  name: string;
  description?: string;
  image?: string; // local file URI, not Base64
  quantity?: number;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
}
