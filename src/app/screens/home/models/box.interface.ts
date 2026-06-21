export interface Item {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity?: number;
  isFragile?: boolean;
  createdAt?: string;
}

export interface Box {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  qrCode: string;
  items?: Item[];
  createdAt?: string;
  updatedAt?: string;
  // Packing-progress lifecycle (Spec 009), distinct from LocalBox's existing
  // active/archived `status`. Optional here since this is the legacy
  // view-model shape and existing callers may not set it; defaults to
  // 'packing' when absent (see box.service.ts's toBox()).
  packingStatus?: 'packing' | 'sealed';
  // Room grouping (Spec 009 Step 3). Optional here since this is the legacy
  // view-model shape; surfaced in box-modal.component.html's form via a
  // fixed list + "Other" free-text fallback (see box.service.ts's mapping).
  room?: string;
}
