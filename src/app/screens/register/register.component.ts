import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { LoginType } from 'src/app/shared/models/login-type.enum';
import { RegisterDto } from 'src/app/shared/models/register.dto';
import { AuthService } from 'src/app/shared/services/auth.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { passwordMatchValidator } from 'src/app/utils/form.utils';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit {
  passInputType: string = 'password';
  confirmPassInputType: string = 'password';
  LoginType = LoginType;
  registerForm: FormGroup = new FormGroup({});
  isPasswordVisible: boolean = false;
  isConfirmPasswordVisible: boolean = false;
  socialLoginEnabled: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private navCtrl: NavController,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    // Obtener si el login social está habilitado desde el AuthService
    this.socialLoginEnabled = this.authService.socialLoginEnabled;
  }

  ngOnInit() {
    this.registerForm = this.formBuilder.group(
      {
        name: ['', [Validators.required]],
        lastname: ['', [Validators.required]],
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

  async socialLogin(loginType: LoginType) {
    try {
      const user = await this.authService.login(loginType);
      if (user) {
        this.navCtrl.navigateRoot('/tabs/home');
      } else {
        this.toastService.presentErrorToast(
          'Could not register with social login (AUTH-100)'
        );
      }
    } catch (error) {
      console.error('Social login error:', error);

      let errorMessage = 'Error in social registration';
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

  changePassVisibility(controlName: string) {
    switch (controlName) {
      case 'password':
        this.isPasswordVisible = !this.isPasswordVisible;
        if (this.isPasswordVisible) {
          this.passInputType = 'text';
        } else {
          this.passInputType = 'password';
        }
        break;
      case 'confirmPassword':
        this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
        if (this.isConfirmPasswordVisible) {
          this.confirmPassInputType = 'text';
        } else {
          this.confirmPassInputType = 'password';
        }
        break;
    }
  }

  async register() {
    const registerDto: RegisterDto = {
      firstName: this.registerForm.value.name,
      lastName: this.registerForm.value.lastname,
      email: this.registerForm.value.email,
      passwordHash: this.registerForm.value.password,
      authProvider: LoginType.EMAIL_AND_PASSWORD,
    };

    try {
      const result = await this.authService.register(registerDto);
      if (result) {
        this.toastService.presentSuccessToast(
          'Registration completed successfully'
        );
        this.navCtrl.navigateRoot('/login');
      }
    } catch (error) {
      console.error('Error during registration:', error);

      // Determine error message based on received code or message
      let errorMessage = 'Error registering user';
      let errorCode = '';

      if (error.status) {
        errorCode = `Error ${error.status}`;

        switch (error.status) {
          case 400:
            errorMessage = 'Invalid registration data';
            break;
          case 409:
            errorMessage = 'User already exists';
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
      }

      this.toastService.presentErrorToast(`${errorMessage} (${errorCode})`);
    }
  }

  private getErrorMessageByCode(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already in use';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/operation-not-allowed':
        return 'Operation not allowed';
      default:
        return 'Registration error';
    }
  }
}
