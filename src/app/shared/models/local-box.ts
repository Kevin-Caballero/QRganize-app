export enum BoxStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface LocalBox {
  id: string; // client-generated UUID v4, primary key. Not the backend numeric id.
  name: string;
  description: string; // '' allowed, not nullable
  room: string; // '' allowed, not nullable — free-text room/location label
  status: BoxStatus; // lifecycle state, independent of soft delete (see deletedAt)
  packingStatus: 'packing' | 'sealed'; // packing-progress lifecycle (Spec 009), independent of `status` (active/archived)
  qrCode: string; // opaque string identifying this box for QR association; format/generation/scanning is out of scope of this spec
  imageUri?: string; // local file URI for the box photo; added per Spec 002 addendum (Spec 003 home-screen wiring)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601, present only when soft-deleted; absent/undefined otherwise
}
