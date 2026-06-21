import { Migration } from './migration.interface';

/**
 * Adds a nullable `firebase_uid` column (+ index) to `boxes`, `items`, and
 * `checklists`, backing per-user local data scoping (see docs/specs.md
 * Spec 011: "Per-user local data scoping"). This corrects Spec 010's
 * "per-user scoping not needed" decision, which did not hold once a second
 * real Firebase user actually signed in on the same device/build — Checklists
 * and Search were observed showing a different signed-in user's data.
 *
 * `checklist_items` deliberately gets NO `firebase_uid` column of its own.
 * Its existing query patterns in `checklist-sqlite.repository.ts` already
 * always operate in the context of a known `checklist_id` (findById,
 * findItemsByChecklistId, update/delete by id), so scoping transitively via
 * a join/lookup against the owning `checklists.firebase_uid` is
 * straightforward and avoids a second column to keep in sync and a second
 * migration touching `checklist_items` (see Spec 011's "Checklist items:
 * join vs. duplicate column" section).
 *
 * Nullable, not NOT NULL: SQLite's `ALTER TABLE ... ADD COLUMN ... NOT NULL`
 * requires a default for pre-existing rows, and at migration-run time we do
 * not yet know which Firebase user "owns" those rows — migrations run
 * before/independently of any specific sign-in event. The column is added as
 * nullable here; a one-time backfill (see `AppStartupRouteService`, which
 * runs immediately after auth state is known at startup) assigns existing
 * NULL rows to the first authenticated user to open the app after this
 * migration runs.
 *
 * Backfill decision (Spec 011, "Backfill decision"): all pre-existing local
 * data (created during the no-login period, or under whichever account
 * happened to be signed in before this migration ran) is attributed to
 * whoever is first to sign in post-migration. This is a deliberate, accepted
 * best-effort heuristic for a ~2-user personal app (per Spec 010's own
 * stated user-volume assumption) — the alternative (leaving orphaned rows
 * NULL and excluding them from all queries) was rejected because it would
 * make a real user's pre-existing boxes/items/checklists silently disappear
 * with no recovery path, which is strictly worse than the small risk of
 * attributing them to the wrong account. The application-level contract
 * going forward (enforced by the repository layer, not a SQL constraint) is
 * "every row must have a non-null `firebase_uid` after the backfill step
 * runs."
 */
export const migration009UserScoping: Migration = {
  version: 9,
  description: 'Add firebase_uid column and index to boxes, items, checklists',
  async up(tx) {
    const boxColumns = await tx.query<{ name: string }>(
      'PRAGMA table_info(boxes);'
    );
    const boxNames = new Set(boxColumns.map((c) => c.name));
    if (!boxNames.has('firebase_uid')) {
      await tx.execute('ALTER TABLE boxes ADD COLUMN firebase_uid TEXT;');
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS idx_boxes_firebase_uid ON boxes(firebase_uid);'
      );
    }

    const itemColumns = await tx.query<{ name: string }>(
      'PRAGMA table_info(items);'
    );
    const itemNames = new Set(itemColumns.map((c) => c.name));
    if (!itemNames.has('firebase_uid')) {
      await tx.execute('ALTER TABLE items ADD COLUMN firebase_uid TEXT;');
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS idx_items_firebase_uid ON items(firebase_uid);'
      );
    }

    const checklistColumns = await tx.query<{ name: string }>(
      'PRAGMA table_info(checklists);'
    );
    const checklistNames = new Set(checklistColumns.map((c) => c.name));
    if (!checklistNames.has('firebase_uid')) {
      await tx.execute(
        'ALTER TABLE checklists ADD COLUMN firebase_uid TEXT;'
      );
      await tx.execute(
        'CREATE INDEX IF NOT EXISTS idx_checklists_firebase_uid ON checklists(firebase_uid);'
      );
    }
  },
};
