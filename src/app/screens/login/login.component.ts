import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController, AlertController } from '@ionic/angular';
import { LoginType } from 'src/app/shared/models/login-type.enum';
import { AuthService } from 'src/app/shared/services/auth.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({});
  isPasswordVisible: boolean = false;
  passInputType: string = 'password';
  LoginType = LoginType;
  socialLoginEnabled: boolean = environment.socialLoginEnabled;
  resetPasswordAvailable: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private navCtrl: NavController,
    private authService: AuthService,
    private toastService: ToastService,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    // Check if reset password functionality is available
    this.resetPasswordAvailable = this.authService.isResetPasswordAvailable();

    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });

    // Load saved credentials if they exist
    try {
      const savedCredentials = await this.authService.getSavedCredentials();

      if (savedCredentials) {
        // Prepare the data to load
        const formData: {
          email: string;
          rememberMe: boolean;
          password?: string;
        } = {
          email: savedCredentials.email,
          rememberMe: savedCredentials.rememberMe,
        };

        // If password is also saved, load it
        if (savedCredentials.password) {
          formData.password = savedCredentials.password;

          // Show a message indicating that complete credentials have been loaded
          this.toastService.presentInfoToast(
            'Credentials automatically loaded'
          );
        } else {
          // If only email is saved, show a message for that case
          this.toastService.presentInfoToast('Email automatically loaded');
        }

        // Update the form with the saved data
        this.loginForm.patchValue(formData);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.navCtrl.navigateForward('/home');
    }
  }

  navigateToRegister() {
    this.navCtrl.navigateRoot('/register');
  }

  changePassVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
    if (this.isPasswordVisible) {
      this.passInputType = 'text';
    } else {
      this.passInputType = 'password';
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
              await this.authService.sendPasswordResetEmail(data.email);
              this.toastService.presentSuccessToast(
                'Password reset email sent. Please check your inbox.'
              );
              return true;
            } catch (error) {
              console.error('Error sending password reset email:', error);

              let errorMessage = 'Failed to send password reset email';
              let errorCode = error.code || 'RESET-ERR';

              // Handle both Firebase errors and backend API errors
              if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address';
              } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address';
              } else if (error.status) {
                // Handle HTTP errors from custom backend API
                errorCode = `API-${error.status}`;

                switch (error.status) {
                  case 404:
                    errorMessage = 'No account found with this email address';
                    break;
                  case 400:
                    errorMessage = 'Please enter a valid email address';
                    break;
                  case 429:
                    errorMessage = 'Too many requests. Please try again later';
                    break;
                  case 500:
                    errorMessage = 'Server error. Please try again later';
                    break;
                  default:
                    errorMessage = error.error?.message || 'Unknown error';
                }
              } else if (
                error.message === 'Firebase authentication is not available' ||
                error.message ===
                  'Reset password functionality is not implemented in this environment'
              ) {
                // This is our custom error when Firebase is disabled but backend API is not yet implemented
                errorMessage =
                  'Password reset functionality is not available in this environment';
                errorCode = 'CONFIG-ERR';
              }

              this.toastService.presentErrorToast(
                `${errorMessage} (${errorCode})`
              );
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async socialLogin(loginType: LoginType) {
    try {
      const user = await this.authService.login(loginType);
      if (user) {
        this.navCtrl.navigateRoot('/tabs/home');
      } else {
        this.toastService.presentErrorToast('Could not log in (AUTH-100)');
      }
    } catch (error) {
      console.error('Social login error:', error);

      let errorMessage = 'Social login error';
      let errorCode = error.code || 'SOC-ERR';

      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email';
        errorCode = 'AUTH-409';
      } else if (error.code) {
        errorMessage = this.getErrorMessageByCode(error.code);
      }

      this.toastService.presentErrorToast(`${errorMessage} (${errorCode})`);
    }
  }

  async login() {
    try {
      console.log('DEBUG - Login Component - Attempting login with:', {
        email: this.loginForm.value.email,
        password: '*********',
        rememberMe: this.loginForm.value.rememberMe,
      });

      // Proceed with login
      const user = await this.authService.login(
        LoginType.EMAIL_AND_PASSWORD,
        this.loginForm.value.email,
        this.loginForm.value.password,
        this.loginForm.value.rememberMe
      );

      if (user) {
        console.log('DEBUG - Login Component - Login successful:', user);
        // Small delay to ensure the token is available for the interceptor
        await new Promise((resolve) => setTimeout(resolve, 200));
        this.navCtrl.navigateRoot('/tabs/home');
      } else {
        this.toastService.presentErrorToast('Invalid credentials (AUTH-401)');
      }
    } catch (error) {
      console.error('DEBUG - Login Component - Complete login error:', error);

      // Determine error message based on received code or message
      let errorMessage = 'Login error';
      let errorCode = '';

      if (error.status) {
        errorCode = `Error ${error.status}`;

        switch (error.status) {
          case 400:
            errorMessage = 'Invalid login data';
            break;
          case 401:
            errorMessage = 'Incorrect username or password';
            break;
          case 403:
            errorMessage = 'Access forbidden';
            break;
          case 500:
            errorMessage = 'Internal server error';
            break;
          default:
            errorMessage = error.error?.message || 'Unknown error';
        }
      } else if (error.code) {
        // Firebase or other service error
        errorCode = error.code;
        errorMessage = this.getErrorMessageByCode(error.code);
      } else if (error.message && error.message.includes('Failed to fetch')) {
        // Network connection error
        errorCode = 'NET-ERR';
        errorMessage = 'Could not connect to server';

        // Show a dialog with more information
        const alert = await this.alertController.create({
          header: 'Connection Error',
          message: `Could not connect to the server. 
                    Verify that the server is running and accessible from your device.
                    Details: ${error.message}`,
          buttons: ['OK'],
        });
        await alert.present();
      }

      this.toastService.presentErrorToast(`${errorMessage} (${errorCode})`);
    }
  }

  private getErrorMessageByCode(code: string): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/user-disabled':
        return 'This user has been disabled';
      case 'auth/user-not-found':
        return 'User not found';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Try again later';
      default:
        return 'Login error';
    }
  }
}
