export interface Item {
  id?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity?: number;
  isFragile?: boolean;
  createdAt?: string;
}

export interface Box {
  id?: number;
  name: string;
  description: string;
  imageUrl: string;
  qrCode: string;
  items?: Item[];
  createdAt?: string;
  updatedAt?: string;
}
