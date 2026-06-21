import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { environment } from 'src/environments/environment';

/**
 * Centralizes resolution of stored image URIs (`boxes.image_uri` /
 * `items.image_uri`) into something an `<img>`/CSS `background-image` can
 * render.
 *
 * See docs/specs.md Spec 012: persisted image references must be durable
 * (Filesystem URIs), never ephemeral `blob:` URLs. Resolution happens here,
 * at render time, every time:
 *
 * - Native (Capacitor native platform): the stored Filesystem URI is
 *   converted via `Capacitor.convertFileSrc()`, which rewrites a
 *   `file://`/`content://` URI into something a native WebView can actually
 *   load.
 * - Web (`ng serve`/PWA): Capacitor's Filesystem plugin on web is backed by
 *   IndexedDB, not a real filesystem, so the stored value is a `Directory`
 *   path, not a loadable URL at all. Resolution must call
 *   `Filesystem.readFile()` and convert the returned base64 data into a
 *   fresh `data:` URL on every call. That `data:` URL is never persisted
 *   back to SQLite — it's purely a render-time artifact.
 *
 * Dead data handling: any stored value starting with `blob:` is treated as
 * unrecoverable (see Spec 012 — these are blob: URLs persisted by a bug
 * fixed in this spec; the underlying blob data was already garbage
 * collected by the time of the fix). `resolveImageSrc()` returns `null` for
 * these so callers fall back to their existing "no image" placeholder
 * instead of attempting to load a guaranteed-dead URL.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageUrlService {
  constructor() {}

  /**
   * Obtiene la URL absoluta para una imagen del servidor
   * @param imagePath Ruta de la imagen (puede ser nombre de archivo o ruta relativa)
   * @returns URL absoluta al recurso
   */
  getAbsoluteUrl(imagePath: string): string {
    if (!imagePath) return '';

    // Si ya es una URL absoluta o un URI de archivo local (blob:, capacitor:,
    // file:, content:, data:) devolverla tal cual — no es un nombre/ruta
    // relativa de imagen del backend. Necesario porque los boxes/items
    // locales ahora guardan URIs de archivo local en vez de rutas del
    // backend (ver docs/specs.md Spec 002 addendum).
    if (
      imagePath.startsWith('http') ||
      imagePath.startsWith('blob:') ||
      imagePath.startsWith('capacitor:') ||
      imagePath.startsWith('file:') ||
      imagePath.startsWith('content:') ||
      imagePath.startsWith('data:')
    ) {
      return imagePath;
    }

    // Extraer el nombre del archivo si es una ruta
    const filename = imagePath.includes('/')
      ? imagePath.split('/').pop() || imagePath
      : imagePath;

    return `${environment.apiUrl}/public/images/${filename}`;
  }

  /**
   * Obtiene la URL base del API según el entorno
   */
  getApiBaseUrl(): string {
    return environment.apiUrl;
  }

  /**
   * Resolves a stored `image_uri` value (see Spec 012) into a renderable
   * image source for `<img [src]>`/CSS `background-image`, or `null` if
   * there is no image / the stored value is dead data.
   *
   * Async because web resolution must read the file out of Capacitor's
   * IndexedDB-backed Filesystem storage and re-encode it as a fresh
   * `data:` URL on every call. Callers (component .ts files) must store the
   * resolved value in a component property (populated via `ngOnInit`/
   * `ngOnChanges`/explicit reload) rather than calling this directly from a
   * template binding.
   */
  async resolveImageSrc(storedUri: string | null | undefined): Promise<string | null> {
    if (!storedUri) {
      return null;
    }

    // Dead data short-circuit (Spec 012): a `blob:` URL persisted before
    // this fix can never resolve again — the in-memory blob it pointed to
    // is already gone. Do not attempt to load it; fall back to "no image".
    if (storedUri.startsWith('blob:')) {
      return null;
    }

    // Legacy backend-relative image paths and already-absolute http(s) URLs
    // pass straight through the existing logic.
    if (
      storedUri.startsWith('http') ||
      !this.isFilesystemUri(storedUri)
    ) {
      return this.getAbsoluteUrl(storedUri);
    }

    const { path, directory } = this.parseFilesystemUri(storedUri);

    if (Capacitor.isNativePlatform()) {
      try {
        // Resolve the marker back into the real native file:// / content://
        // URI, then let convertFileSrc() rewrite it into a scheme the
        // native WebView is allowed to load directly. Cheap — no file
        // bytes are read here, just a path lookup.
        const { uri } = await Filesystem.getUri({ path, directory });
        return Capacitor.convertFileSrc(uri);
      } catch {
        return null;
      }
    }

    // Web: Filesystem is IndexedDB-backed, so the stored value is a
    // Directory.Data-relative path, not a directly loadable URL. Read it
    // back out and re-encode as a fresh data: URL every time — never cache
    // or persist this back to SQLite.
    try {
      const result = await Filesystem.readFile({ path, directory });
      const base64 = typeof result.data === 'string' ? result.data : null;
      if (!base64) {
        return null;
      }
      const mimeType = this.guessMimeType(path);
      return `data:${mimeType};base64,${base64}`;
    } catch {
      // File missing/unreadable — treat as no image rather than throwing.
      return null;
    }
  }

  /**
   * Copies a picked `File` (from the web `<input type=file>` fallback in
   * `box-modal.component.ts`/`item-modal.component.ts`) into durable
   * on-device storage via `@capacitor/filesystem`, and returns the stable
   * marker URI to persist into the box/item model field instead of a
   * `URL.createObjectURL(file)` blob: URL.
   *
   * Stored format: `qrganize-fs://<Directory>/<generated-filename>` — see
   * `parseFilesystemUri()`/`isFilesystemUri()` for why a custom marker is
   * used instead of `Filesystem.writeFile()`'s raw returned `uri` (that
   * value isn't a stable, re-readable reference on web, where Filesystem is
   * IndexedDB-backed rather than a real filesystem).
   */
  async persistPickedFile(file: File): Promise<string> {
    const base64Data = await this.readFileAsBase64(file);
    const filename = this.generateFilename(file.name);

    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Data,
    });

    return `qrganize-fs://${Directory.Data}/${filename}`;
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // FileReader.readAsDataURL() yields "data:<mime>;base64,<data>" —
        // Filesystem.writeFile() wants just the base64 payload.
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private generateFilename(originalName: string): string {
    const extension = originalName.includes('.')
      ? originalName.split('.').pop()
      : 'jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${unique}.${extension}`;
  }

  /**
   * Stored Filesystem URIs use a `qrganize-fs://<directory>/<path>` marker
   * format (chosen in Spec 012; documented here since it's the single
   * source of truth for the format). This lets resolution recover which
   * `Directory` a relative path was written under, since the real
   * `Filesystem.writeFile()` native `uri` result isn't usable as-is on web.
   */
  private isFilesystemUri(value: string): boolean {
    return value.startsWith('qrganize-fs://');
  }

  private parseFilesystemUri(uri: string): { directory: Directory; path: string } {
    // Format: qrganize-fs://DATA/<filename>
    const withoutScheme = uri.replace('qrganize-fs://', '');
    const [directory, ...rest] = withoutScheme.split('/');
    return { directory: directory as Directory, path: rest.join('/') };
  }

  private guessMimeType(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
}
