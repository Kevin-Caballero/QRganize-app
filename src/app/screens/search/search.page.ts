import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { BoxService } from '../home/services/box.service';
import { ChecklistService } from '../home/services/checklist.service';
import { Box } from '../home/models/box.interface';
import { LocalChecklist } from 'src/app/shared/models/local-checklist';
import { QrScannerComponent } from 'src/app/shared/components/qr-scanner/qr-scanner.component';
import { ToastService } from 'src/app/shared/services/toast.service';
import { ImageUrlService } from 'src/app/shared/services/image-url.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  searchTerm = '';
  boxResults: Box[] = [];
  checklistResults: LocalChecklist[] = [];
  isSearching = false;
  hasSearched = false;

  // Resolved box thumbnail sources (Spec 012) -- see ImageUrlService.resolveImageSrc.
  boxImageUrls: { [boxId: string]: string | null } = {};

  // Per-checklist item completion counts (Spec 013), mirrored from
  // `checklists.page.ts`'s `getCompletionPercentage()` pattern, but kept
  // simple here since search results don't need a live subscription.
  checklistCompletion: {
    [checklistId: string]: { total: number; completed: number };
  } = {};

  constructor(
    private modalController: ModalController,
    private navController: NavController,
    private boxService: BoxService,
    private checklistService: ChecklistService,
    private toastService: ToastService,
    private imageUrlService: ImageUrlService
  ) {}

  ngOnInit() {}

  get totalResultsCount(): number {
    return this.boxResults.length + this.checklistResults.length;
  }

  async onSearch() {
    if (!this.searchTerm.trim()) {
      return;
    }

    this.isSearching = true;
    this.hasSearched = true;

    try {
      forkJoin({
        boxes: this.boxService.searchBoxes(this.searchTerm),
        checklists: this.checklistService.searchChecklists(this.searchTerm),
      }).subscribe({
        next: ({ boxes, checklists }) => {
          this.boxResults = boxes;
          this.checklistResults = checklists;
          this.isSearching = false;
          this.resolveBoxImages(boxes);
          this.resolveChecklistCompletion(checklists);
        },
        error: (error) => {
          console.error('Search error:', error);
          this.isSearching = false;
          this.toastService.presentErrorToast('Error occurred while searching');
        },
      });
    } catch (error) {
      console.error('Search error:', error);
      this.isSearching = false;
      await this.toastService.presentErrorToast(
        'Error occurred while searching'
      );
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.boxResults = [];
    this.checklistResults = [];
    this.hasSearched = false;
  }

  private resolveBoxImages(boxes: Box[]) {
    boxes.forEach((box) => {
      if (!box.id) return;
      this.imageUrlService.resolveImageSrc(box.imageUrl).then((resolved) => {
        this.boxImageUrls[box.id as string] = resolved;
      });
    });
  }

  /**
   * Resolved (render-time) box thumbnail source, or null for "no image"
   * (including dead blob: rows — see ImageUrlService.resolveImageSrc).
   */
  getResolvedBoxImageUrl(box: Box): string | null {
    return box.id ? this.boxImageUrls[box.id] ?? null : null;
  }

  private resolveChecklistCompletion(checklists: LocalChecklist[]) {
    checklists.forEach((checklist) => {
      this.checklistService
        .getChecklistCompletion(checklist.id)
        .subscribe((completion) => {
          this.checklistCompletion[checklist.id] = completion;
        });
    });
  }

  getChecklistCompletionPercentage(checklist: LocalChecklist): number {
    const counts = this.checklistCompletion[checklist.id];
    if (!counts || counts.total === 0) return 0;
    return Math.round((counts.completed / counts.total) * 100);
  }

  getChecklistCompletedCount(checklist: LocalChecklist): number {
    return this.checklistCompletion[checklist.id]?.completed ?? 0;
  }

  getChecklistTotalCount(checklist: LocalChecklist): number {
    return this.checklistCompletion[checklist.id]?.total ?? 0;
  }

  async openQrScanner() {
    const modal = await this.modalController.create({
      component: QrScannerComponent,
    });

    await modal.present();
  }

  onSearchInput(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    if (this.searchTerm.trim()) {
      this.onSearch();
    } else {
      this.clearSearch();
    }
  }

  getMatchingItems(box: Box) {
    if (!box.items || !this.searchTerm) {
      return [];
    }

    const term = this.searchTerm.toLowerCase();
    return box.items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }

  hasMatchingItems(box: Box): boolean {
    return this.getMatchingItems(box).length > 0;
  }

  openChecklistDetail(checklist: LocalChecklist) {
    this.navController.navigateForward(`/tabs/checklist/${checklist.id}`);
  }
}
