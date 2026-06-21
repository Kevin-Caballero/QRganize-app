import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { AuthGateService } from 'src/app/shared/services/auth-gate.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { passwordMatchValidator } from 'src/app/utils/form.utils';

/**
 * Sign-up screen, repurposed for Firebase email/password sign-up
 * (Spec 010). Calls `AuthGateService` only — never the Firebase plugin or
 * `AuthRepository` directly, per docs/architecture.md's mandatory layering.
 */
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit {
  passInputType: 'password' | 'text' = 'password';
  confirmPassInputType: 'password' | 'text' = 'password';
  registerForm: FormGroup = new FormGroup({});
  isPasswordVisible = false;
  isConfirmPasswordVisible = false;
  isSubmitting = false;

  constructor(
    private formBuilder: FormBuilder,
    private navCtrl: NavController,
    private authGateService: AuthGateService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.registerForm = this.formBuilder.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
      },
      {
        validator: passwordMatchValidator('password', 'confirmPassword'),
      }
    );
  }

  navigateToLogin() {
    this.navCtrl.navigateRoot('/login');
  }

  async registerWithGoogle() {
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

  changePassVisibility(controlName: 'password' | 'confirmPassword') {
    if (controlName === 'password') {
      this.isPasswordVisible = !this.isPasswordVisible;
      this.passInputType = this.isPasswordVisible ? 'text' : 'password';
    } else {
      this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
      this.confirmPassInputType = this.isConfirmPasswordVisible
        ? 'text'
        : 'password';
    }
  }

  async register() {
    if (this.registerForm.invalid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    try {
      await this.authGateService.signUpWithEmail(
        this.registerForm.value.email,
        this.registerForm.value.password
      );
      this.toastService.presentSuccessToast(
        'Account created successfully'
      );
      this.navCtrl.navigateRoot('/tabs/home');
    } catch (error) {
      this.toastService.presentErrorToast(this.getFriendlyErrorMessage(error));
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Maps Firebase Auth error codes to plain, non-technical messages, per
   * Spec 010's UI/UX requirement ("no raw Firebase error codes surfaced to
   * the user").
   */
  private getFriendlyErrorMessage(error: any): string {
    const code = error?.code as string | undefined;
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 8 characters.';
      case 'auth/operation-not-allowed':
        return 'Sign-up is not available right now. Please try again later.';
      case 'auth/network-request-failed':
        return 'Could not connect. Please check your internet connection.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-up was cancelled.';
      default:
        return 'Something went wrong while creating your account. Please try again.';
    }
  }
}
