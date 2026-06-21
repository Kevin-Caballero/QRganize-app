import { Migration } from './migration.interface';
import { migration001SchemaVersion } from './001_schema_version';
import { migration002Boxes } from './002_boxes';
import { migration003Items } from './003_items';
import { migration004Checklists } from './004_checklists';
import { migration005BoxImageUri } from './005_box_image_uri';
import { migration006ItemExtraFields } from './006_item_extra_fields';
import { migration007ChecklistExtraFields } from './007_checklist_extra_fields';
import { migration008BoxPackingStatus } from './008_box_packing_status';
import { migration009UserScoping } from './009_user_scoping';
import { migration010ChecklistItemLinkedItem } from './010_checklist_item_linked_item';

/**
 * Append-only, ascending list of all migrations known to the app.
 * Add new migrations to the end of this array; never reorder or edit
 * an existing entry once merged (see docs/conventions.md).
 */
export const migrations: Migration[] = [
  migration001SchemaVersion,
  migration002Boxes,
  migration003Items,
  migration004Checklists,
  migration005BoxImageUri,
  migration006ItemExtraFields,
  migration007ChecklistExtraFields,
  migration008BoxPackingStatus,
  migration009UserScoping,
  migration010ChecklistItemLinkedItem,
];
