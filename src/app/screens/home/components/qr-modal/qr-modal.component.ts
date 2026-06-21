import { Component, Input, OnInit } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as QRCode from 'qrcode';
import { ToastService } from 'src/app/shared/services/toast.service';

interface QrCodeData {
  name: string;
  qrCode: string; // raw `qrganize:box:<id>` payload, rendered to an image below
}

interface RenderedQrCode extends QrCodeData {
  imageDataUrl: string;
}

type QrLayout = 'large' | 'medium' | 'small';

/**
 * Per layout: how many QR codes fill one A4 sheet, and how many columns
 * they're arranged in (rows-per-page is implied: `slotsPerPage / cols`).
 * `composeQrImage()` always renders a canvas whose width/height is a
 * multiple of a fixed A4-proportioned page, REGARDLESS of how many items
 * there actually are -- e.g. printing just 2 boxes with `small` still
 * produces a full 3x3-grid-shaped page (with empty cells), not a
 * short 1-row strip. A short/wide image is what Android's print framework
 * auto-rotates/blows-up to fill a portrait page, which is the bug this
 * fixes (a 2-item, 1-row `small` grid was previously only ~1240x370px --
 * a 3.4:1 wide-short image -- and printed as one giant QR).
 */
const SLOTS_PER_PAGE: Record<QrLayout, number> = {
  large: 2,
  medium: 4,
  small: 9,
};
const COLS_PER_LAYOUT: Record<QrLayout, number> = {
  large: 1,
  medium: 2,
  small: 3,
};

/**
 * Renders local box QR codes client-side from the `qrganize:box:<id>`
 * payload string (see docs/specs.md Spec 002/003 — local boxes no longer
 * get a backend-generated QR image; the payload is rendered here using the
 * `qrcode` package instead). Pages/components still never call SQLite or a
 * repository directly — this component only depends on `Box.qrCode`, a
 * plain string, passed in by the caller.
 */
@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
})
export class QrModalComponent implements OnInit {
  @Input() qrData!: string; // Para un solo código QR
  @Input() multipleQrCodes: QrCodeData[] = []; // Para múltiples códigos QR
  @Input() isMultiple: boolean = false;

  renderedQrCodes: RenderedQrCode[] = [];
  qrLayout: QrLayout = 'medium';

  constructor(
    private modalCtrl: ModalController,
    private platform: Platform,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    // Si tenemos un solo código QR y no tenemos múltiples, creamos una entrada en multipleQrCodes
    if (!this.isMultiple && this.qrData) {
      this.multipleQrCodes = [
        {
          name: 'QR Code',
          qrCode: this.qrData,
        },
      ];
      this.isMultiple = false;
    }

    await this.renderQrCodes();
  }

  private async renderQrCodes() {
    this.renderedQrCodes = await Promise.all(
      this.multipleQrCodes.map(async (item) => ({
        ...item,
        imageDataUrl: await this.toDataUrl(item.qrCode),
      }))
    );
  }

  private async toDataUrl(qrCode: string): Promise<string> {
    try {
      return await QRCode.toDataURL(qrCode, { margin: 1, width: 256 });
    } catch (error) {
      console.error('Error rendering QR code:', error);
      return '';
    }
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  /**
   * `window.print()` (the previous implementation) is a no-op in Android's
   * WebView -- Capacitor/Cordova apps never get a print dialog from it,
   * which is why tapping "Print" silently did nothing on a real device. On
   * native platforms, this composes every rendered QR code (plus its box
   * name label) onto a single image, writes it to a temp file, and opens
   * the OS share sheet via `@capacitor/share` -- on Android this share
   * sheet itself commonly includes a "Print" target (the system's Default
   * Print Service integrates directly into it), alongside any printer
   * apps the user has installed, so this is a real print path, not a
   * workaround that merely shares the image. `window.print()` is kept as
   * the web/dev (`ng serve`) fallback, where it works fine in a real
   * browser tab.
   */
  async printQr() {
    if (!this.platform.is('capacitor')) {
      setTimeout(() => window.print(), 300);
      return;
    }

    try {
      const dataUrl = await this.composeQrImage();
      const base64Data = dataUrl.split(',')[1];
      const fileName = `qrganize-qr-${Date.now()}.png`;

      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: this.isMultiple ? 'QR Codes' : 'QR Code',
        url: written.uri,
        dialogTitle: 'Print or share QR code',
      });
    } catch (error) {
      console.error('Error printing/sharing QR code:', error);
      await this.toastService.presentErrorToast(
        'Could not open the print/share dialog'
      );
    }
  }

  /**
   * Draws every rendered QR code (with its box-name label) onto a single
   * canvas, grid-laid-out per `qrLayout`, and returns it as a PNG data URL
   * -- this is what actually gets printed/shared, since `@capacitor/share`
   * shares one file, not a list.
   *
   * The canvas is always an exact multiple of one A4-proportioned page
   * (`PAGE_WIDTH` x `PAGE_HEIGHT`) -- cell size is derived from the page
   * and the layout's fixed row/column count, NOT from how many QR codes
   * there actually are. This is what keeps the image's aspect ratio a real
   * page shape no matter the item count (2 items in a `small` 3-column
   * layout still renders a full 3x3 page with mostly-empty cells, not a
   * short single row) -- see the `SLOTS_PER_PAGE`/`COLS_PER_LAYOUT` doc
   * comment for the bug this fixes. If there are more items than fit on
   * one page, the canvas grows by whole additional page-heights (still
   * portrait-shaped, just taller) -- `@capacitor/share` shares one file,
   * so true multi-page printing isn't supported; the OS print framework
   * will scale a multi-page-tall image down to fit one physical sheet,
   * which is an acceptable degradation at this app's expected (a handful
   * of boxes) scale.
   */
  private async composeQrImage(): Promise<string> {
    const PAGE_WIDTH = 1240; // ~A4 width at 150dpi
    const PAGE_HEIGHT = 1754; // ~A4 height at 150dpi
    const labelHeight = 50;
    const margin = 20;

    const slotsPerPage = SLOTS_PER_PAGE[this.qrLayout];
    const cols = COLS_PER_LAYOUT[this.qrLayout];
    const rowsPerPage = slotsPerPage / cols;

    const cellWidth = PAGE_WIDTH / cols;
    const cellHeight = PAGE_HEIGHT / rowsPerPage;
    const qrSize = Math.min(cellWidth, cellHeight) - margin * 2 - labelHeight;

    const pagesNeeded = Math.max(
      1,
      Math.ceil(this.renderedQrCodes.length / slotsPerPage)
    );

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT * pagesNeeded;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = `${Math.max(16, qrSize / 18)}px sans-serif`;
    ctx.textAlign = 'center';

    for (let i = 0; i < this.renderedQrCodes.length; i++) {
      const item = this.renderedQrCodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellWidth;
      const y = row * cellHeight;

      const img = await this.loadImage(item.imageDataUrl);
      ctx.drawImage(
        img,
        x + (cellWidth - qrSize) / 2,
        y + (cellHeight - qrSize - labelHeight) / 2,
        qrSize,
        qrSize
      );
      ctx.fillText(
        item.name,
        x + cellWidth / 2,
        y + (cellHeight - qrSize - labelHeight) / 2 + qrSize + labelHeight - 10,
        cellWidth - margin
      );
    }

    return canvas.toDataURL('image/png');
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load QR image'));
      img.src = src;
    });
  }
}
