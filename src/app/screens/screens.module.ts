import { NgModule } from '@angular/core';
import { HomeModule } from './home/home.module';
import { LoginModule } from './login/login.module';
import { RegisterModule } from './register/register.module';
import { LandingModule } from './landing/landing.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@NgModule({
  declarations: [],
  imports: [
    HomeModule,
    LoginModule,
    RegisterModule,
    LandingModule,
    OnboardingModule,
  ],
})
export class ScreensModule {}
