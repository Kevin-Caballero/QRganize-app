import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

export type AppTheme = 'light' | 'dark' | 'system';
export type AppFontSize = 'small' | 'medium' | 'large';

const THEME_STORAGE_KEY = 'theme';
const FONT_SIZE_STORAGE_KEY = 'fontSize';
const DEFAULT_THEME: AppTheme = 'system';
const DEFAULT_FONT_SIZE: AppFontSize = 'medium';

/**
 * Single shared place that applies persisted appearance settings (theme,
 * font size) to `document.body`. Used both at app startup (Spec 016's fix
 * for the "wrong theme/font size flash on cold start" gap) and from the
 * Settings page, so there is exactly one copy of this logic instead of two
 * diverging copies.
 *
 * This is a plain Angular service operating on `document.body`/`Storage`/
 * `matchMedia` -- not a data-access concern, so it does not go through the
 * Page -> Feature Service -> Repository -> SQLite layering rule.
 */
@Injectable({
  providedIn: 'root',
})
export class AppearanceService {
  private systemThemeMediaQuery: MediaQueryList | null = null;
  private systemThemeListener: ((event: MediaQueryListEvent) => void) | null =
    null;

  constructor(private storage: Storage) {}

  /**
   * Applies the given theme to `document.body`.
   *
   * - `'light'`: removes the `dark` class.
   * - `'dark'`: adds the `dark` class.
   * - `'system'`: reads `window.matchMedia('(prefers-color-scheme: dark)')`
   *   once to set/unset the class, then attaches a change listener so the
   *   app keeps following live OS changes for as long as `'system'` remains
   *   selected.
   *
   * Switching away from `'system'` detaches any previously attached
   * listener so it does not keep firing after the user picks an explicit
   * Light/Dark choice.
   */
  applyTheme(theme: AppTheme): void {
    this.detachSystemThemeListener();

    if (theme === 'light') {
      document.body.classList.remove('dark');
      return;
    }

    if (theme === 'dark') {
      document.body.classList.add('dark');
      return;
    }

    // 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.setDarkClass(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      this.setDarkClass(event.matches);
    };
    mediaQuery.addEventListener('change', listener);

    this.systemThemeMediaQuery = mediaQuery;
    this.systemThemeListener = listener;
  }

  /**
   * Applies the given font size to `document.body`, mirroring the previous
   * per-page logic in `SettingsPage.applyFontSize` (moved here so it is not
   * duplicated between startup and the Settings page).
   */
  applyFontSize(size: AppFontSize): void {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${size}`);
  }

  /**
   * Reads the persisted theme and font size from `Storage` (defaulting to
   * `'system'` / `'medium'` if unset) and applies both. Intended to be
   * awaited early in app startup, before the first route renders, so the
   * correct appearance is in place without requiring a visit to Settings.
   */
  async loadAndApplyPersistedAppearance(): Promise<void> {
    const theme: AppTheme =
      (await this.storage.get(THEME_STORAGE_KEY)) || DEFAULT_THEME;
    const fontSize: AppFontSize =
      (await this.storage.get(FONT_SIZE_STORAGE_KEY)) || DEFAULT_FONT_SIZE;

    this.applyTheme(theme);
    this.applyFontSize(fontSize);
  }

  private setDarkClass(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  private detachSystemThemeListener(): void {
    if (this.systemThemeMediaQuery && this.systemThemeListener) {
      this.systemThemeMediaQuery.removeEventListener(
        'change',
        this.systemThemeListener
      );
    }
    this.systemThemeMediaQuery = null;
    this.systemThemeListener = null;
  }
}
