import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { AuthGateService } from './auth-gate.service';
import { SqliteService } from '../../core/sqlite/sqlite.service';

/**
 * Encapsulates the app-shell startup navigation decision.
 *
 * Per Spec 010 ("Mandatory Firebase Authentication gate"), this is a
 * deliberate reversal of the previous guarantee (Spec 005, now Superseded;
 * formerly described here as "Spec 006" due to a pre-existing numbering
 * drift — see Spec 009/010's Risks) that startup routing must not depend on
 * auth state. The app is no longer usable without a signed-in session:
 * startup now routes to `/login` whenever there is no authenticated
 * Firebase user, regardless of `onboardingComplete`. `AuthGuard` enforces
 * the same rule for in-app navigation (e.g. deep links); this service only
 * covers the initial startup route.
 */
@Injectable({
  providedIn: 'root',
})
export class AppStartupRouteService {
  constructor(
    private storage: Storage,
    private authGateService: AuthGateService,
    private sqliteService: SqliteService
  ) {}

  /**
   * Resolves the root route the app should navigate to on startup.
   *
   * - No authenticated Firebase user: `/login` (mandatory gate, Spec 010).
   * - Authenticated, onboarding not complete: `/onboarding`.
   * - Authenticated, onboarding complete: `/tabs/home`.
   *
   * Also triggers the Spec 011 ("Per-user local data scoping") one-time
   * backfill of any pre-existing NULL `firebase_uid` rows once the current
   * user is known. This is the chosen hook point because:
   * - It already runs exactly once per app start, by the time `AppComponent`
   *   calls it `SqliteService.initialize()` (migrations included) has always
   *   already completed.
   * - It is the first point in the startup sequence where a non-null
   *   Firebase user is actually known — migration 009 itself runs earlier,
   *   independently of any sign-in event, so it cannot know "who is the
   *   current user" at that point.
   * - `SqliteService.backfillFirebaseUid` is itself idempotent (a no-op once
   *   every row has a non-null `firebase_uid`), so calling it on every
   *   startup (not just the first one post-migration) is safe and requires
   *   no extra "have I already backfilled" flag.
   */
  async resolveStartupRoute(): Promise<string> {
    const user = await this.authGateService.getCurrentUser();
    if (!user) {
      return '/login';
    }

    await this.sqliteService.backfillFirebaseUid(user.uid);

    const onboardingComplete = await this.storage.get('onboardingComplete');
    return onboardingComplete ? '/tabs/home' : '/onboarding';
  }
}
