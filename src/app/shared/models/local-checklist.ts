export enum ChecklistStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface LocalChecklist {
  id: string; // client-generated UUID v4, primary key
  title: string; // non-empty (see Decisions)
  description: string; // '' allowed, not nullable
  status: ChecklistStatus; // lifecycle state, independent of soft delete
  boxId?: string; // nullable, references LocalBox.id — see Spec 002 Addendum 2
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601, present only when soft-deleted
}

export interface LocalChecklistItem {
  id: string; // client-generated UUID v4, primary key
  checklistId: string; // references LocalChecklist.id
  title: string; // non-empty (see Decisions)
  notes: string; // '' allowed, not nullable
  isCompleted: boolean; // checklist-item check state — NOT a lifecycle/soft-delete state, see Decisions
  sortOrder: number; // integer, see "sortOrder assignment" decision
  quantity?: number; // see Spec 002 Addendum 2
  isFragile?: boolean; // see Spec 002 Addendum 2
  expires?: boolean; // see Spec 002 Addendum 2
  expirationDate?: string; // ISO 8601, see Spec 002 Addendum 2
  imageUri?: string; // local file URI, see Spec 002 Addendum 2
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601, present only when soft-deleted
}
