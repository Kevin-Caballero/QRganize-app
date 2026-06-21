export interface BoxReqDto {
  name: string;
  description: string;
  image: string;
  // UUID of the checklist to assign to this box at creation time (optional).
  // Was previously (incorrectly) typed `number`; checklist ids are UUID
  // strings (see LocalChecklist.id) — see docs/specs.md Spec 014.
  checklistId?: string;
  // Packing-progress lifecycle (Spec 009). Optional — not yet surfaced in
  // box-modal.component.html's form (that's Spec 009 Step 3/5); present here
  // so BoxService's mapping can forward it once a caller sets it.
  packingStatus?: 'packing' | 'sealed';
  // Room grouping (Spec 009 Step 3). Optional — set from box-modal.component.ts's
  // fixed-list + "Other" free-text form control; forwarded by BoxService's
  // mapping to LocalBoxesService's `room` field (no schema change needed).
  room?: string;
}
