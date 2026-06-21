export enum ItemStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface LocalItem {
  id: string; // client-generated UUID v4, primary key. Not the backend numeric id.
  boxId: string; // references LocalBox.id
  name: string;
  description: string; // '' allowed, not nullable
  category: string; // '' allowed, not nullable — free-text category label
  quantity: number; // integer, minimum 1 (see Decisions)
  status: ItemStatus; // lifecycle state, independent of soft delete (see deletedAt)
  imageUri: string; // opaque string (local file URI or path); '' allowed. No file storage/upload logic in this spec — just a string column
  isFragile?: boolean; // added per Spec 002 addendum (Spec 003 home-screen wiring)
  expires?: boolean; // added per Spec 002 addendum (Spec 003 home-screen wiring)
  expirationDate?: string; // ISO 8601; added per Spec 002 addendum (Spec 003 home-screen wiring)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601, present only when soft-deleted; absent/undefined otherwise
}
