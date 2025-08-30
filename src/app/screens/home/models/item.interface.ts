export interface Item {
  id: number;
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
  image?: string; // Base64 image data
  quantity?: number;
  isFragile?: boolean;
  expires?: boolean;
  expirationDate?: Date;
}
