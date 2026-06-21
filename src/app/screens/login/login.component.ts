import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, NavController } from '@ionic/angular';
import { AuthGateService } from 'src/app/shared/services/auth-gate.service';
import { ToastService } from 'src/app/shared/services/toast.service';

/**
 * Login screen, repurposed for the mandatory Firebase Authentication gate
 * (Spec 010). Offers email/password sign-in and Google sign-in, both via
 * `AuthGateService` — never the Firebase plugin or `AuthRepository`
 * directly, per docs/architecture.md's mandatory layering.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({});
  isPasswordVisible = false;
  passInputType: 'password' | 'text' = 'password';
  isSubmitting = false;

  constructor(
    private formBuilder: FormBuilder,
    private navCtrl: NavController,
    private authGateService: AuthGateService,
    private toastService: ToastService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  navigateToRegister() {
    this.navCtrl.navigateRoot('/register');
  }

  changePassVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
    this.passInputType = this.isPasswordVisible ? 'text' : 'password';
  }

  async login() {
    if (this.loginForm.invalid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    try {
      await this.authGateService.signInWithEmail(
        this.loginForm.value.email,
        this.loginForm.value.password
      );
      this.navCtrl.navigateRoot('/tabs/home');
    } catch (error) {
      this.toastService.presentErrorToast(this.getFriendlyErrorMessage(error));
    } finally {
      this.isSubmitting = false;
    }
  }

  async loginWithGoogle() {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    try {
      await this.authGateService.signInWithGoogle();
      this.navCtrl.navigateRoot('/tabs/home');
    } catch (error) {
      this.toastService.presentErrorToast(this.getFriendlyErrorMessage(error));
    } finally {
      this.isSubmitting = false;
    }
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      message:
        "Enter your email address and we'll send you a link to reset your password.",
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email',
          value: this.loginForm.get('email').value || '',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Send Reset Link',
          handler: async (data) => {
            if (!data.email) {
              this.toastService.presentErrorToast(
                'Please enter your email address'
              );
              return false;
            }

            try {
              await this.authGateService.sendPasswordResetEmail(data.email);
              this.toastService.presentSuccessToast(
                'Password reset email sent. Please check your inbox.'
              );
              return true;
            } catch (error) {
              this.toastService.presentErrorToast(
                this.getFriendlyErrorMessage(error)
              );
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Maps Firebase Auth error codes to plain, non-technical messages, per
   * Spec 010's UI/UX requirement ("no raw Firebase error codes surfaced to
   * the user").
   */
  private getFriendlyErrorMessage(error: any): string {
    const code = error?.code as string | undefined;
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with a different sign-in method for this email.';
      case 'auth/network-request-failed':
        return 'Could not connect. Please check your internet connection.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled.';
      default:
        return 'Something went wrong while signing in. Please try again.';
    }
  }
}
