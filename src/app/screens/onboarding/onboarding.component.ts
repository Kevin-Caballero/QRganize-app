import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Swiper } from 'swiper';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
})
export class OnboardingComponent implements OnInit {
  @ViewChild('swiper')
  swiperRef: ElementRef | undefined;
  progress = 0;
  canNext: boolean = true;

  constructor(private navCtrl: NavController, private storage: Storage) {}

  async startApp() {
    await this.storage.set('onboardingComplete', 'true');
    this.navCtrl.navigateRoot('/login');
  }

  ngOnInit() {
    this.updateProgress();
  }

  next() {
    this.updateProgress();
    this.swiperRef?.nativeElement.swiper.slideNext();
  }

  skip() {
    this.startApp();
  }

  updateProgress() {
    //it goes from 0 to 1
    this.progress = (this.swiperRef?.nativeElement.swiper.activeIndex || 0) / 3;
    if (this.progress === 1) {
      this.canNext = false;
    } else {
      this.canNext = true;
    }
  }

  onSlideChange() {
    this.updateProgress();
  }
}
