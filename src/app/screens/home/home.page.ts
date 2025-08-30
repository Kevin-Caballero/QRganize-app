import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BoxModalComponent } from './components/box-modal/box-modal.component';
import { BoxService } from './services/box.service';
import { Subject, Subscription } from 'rxjs';
import { Box } from './models/box.interface';
import { ErrorHandlerService } from 'src/app/shared/services/error-handler.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { MessageService } from 'src/app/shared/services/message.service';
import { EntityType } from 'src/app/shared/models/entity-type.enum';
import { BoxReqDto } from './models/box-req.dto';
import { BoxStateService } from './services/box-state.service';
import { BoxListComponent } from './components/box-list/box-list.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  private boxSubject = new Subject<BoxReqDto>();
  boxes$ = this.boxStateService.boxes$;

  @ViewChild(BoxListComponent) boxListComponent: BoxListComponent;

  constructor(
    private modalController: ModalController,
    private boxStateService: BoxStateService,
    private errorHandlerService: ErrorHandlerService,
    private toastService: ToastService,
    private messageService: MessageService
  ) {}

  private createBoxHandler = () => {
    this.onAdd();
  };

  ngOnInit(): void {
    // Add event listener for createBox events from the box-list component
    document.addEventListener('createBox', this.createBoxHandler);
  }

  ionViewWillEnter() {
    // Este método se llamará cada vez que la página se vuelve a mostrar
    // Por ejemplo, cuando regreses desde el detalle de una caja
    if (this.boxListComponent) {
      this.boxListComponent.refreshData();
    }
  }

  ngOnDestroy() {
    // Limpiamos todas las suscripciones al destruir el componente
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // También eliminamos el event listener usando la misma referencia de función
    document.removeEventListener('createBox', this.createBoxHandler);
  }

  private subscription: Subscription;

  public async onAdd() {
    // Limpiamos cualquier suscripción existente para evitar múltiples llamadas
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    const modal = await this.modalController.create({
      component: BoxModalComponent,
      componentProps: {
        boxSubject: this.boxSubject,
      },
    });

    // Creamos la suscripción y la guardamos para poder limpiarla después
    this.subscription = this.boxSubject.subscribe((box: BoxReqDto) => {
      this.boxStateService.createBox(box);
    });

    await modal.present();

    // Limpiamos la suscripción cuando se cierra el modal
    const { data } = await modal.onDidDismiss();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
