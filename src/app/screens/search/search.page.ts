import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BoxService } from '../home/services/box.service';
import { Box } from '../home/models/box.interface';
import { QrScannerComponent } from 'src/app/shared/components/qr-scanner/qr-scanner.component';
import { ToastService } from 'src/app/shared/services/toast.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  searchTerm = '';
  searchResults: Box[] = [];
  isSearching = false;
  hasSearched = false;

  constructor(
    private modalController: ModalController,
    private boxService: BoxService,
    private toastService: ToastService
  ) {}

  ngOnInit() {}

  async onSearch() {
    if (!this.searchTerm.trim()) {
      return;
    }

    this.isSearching = true;
    this.hasSearched = true;

    try {
      this.boxService.searchBoxes(this.searchTerm).subscribe({
        next: (boxes) => {
          this.searchResults = boxes;
          this.isSearching = false;
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
    this.searchResults = [];
    this.hasSearched = false;
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
}
