import { Injectable, Optional, Inject } from '@angular/core';
import { User } from '../models/user';
import { LoginType } from '../models/login-type.enum';
import { RegisterDto } from '../models/register.dto';
import { BusinessOperationsService } from './business-operations.service';
import { HttpClient } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { environment } from 'src/environments/environment';

// Import AngularFireAuth type for type checking
import { AngularFireAuth } from '@angular/fire/compat/auth';

// Import Firebase auth types and providers
// These will only be used when socialLoginEnabled is true
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  EmailAuthProvider,
  AuthProvider,
} from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  storageReady: boolean = false;
  socialLoginEnabled: boolean = environment.socialLoginEnabled;

  constructor(
    private businessOperationsService: BusinessOperationsService,
    private http: HttpClient,
    private storage: Storage,
    // Use @Inject with @Optional to properly handle the null case
    @Optional()
    @Inject('AngularFireAuth')
    private angularFireAuth: AngularFireAuth
  ) {
    this.initStorage();

    // Log whether Firebase is being used
    if (this.socialLoginEnabled && !this.angularFireAuth) {
      console.warn(
        'Social login is enabled in the environment, but AngularFireAuth is not available. Check your module imports.'
      );
    }
  }

  private async initStorage() {
    await this.storage.create();
    this.storageReady = true;
  }

  async register(registerDto: RegisterDto): Promise<User> {
    try {
      return new Promise<User>((resolve, reject) => {
        this.http
          .post(this.businessOperationsService.register(), registerDto)
          .subscribe({
            next: (response: any) => {
              console.log('User registered successfully:', response);
              resolve(response as User);
            },
            error: (error) => {
              console.error(
                '%c [ error ]-41',
                'font-size:13px; background:pink; color:#bf2c9f;',
                error
              );
              reject(error);
            },
          });
      });
    } catch (error) {
      console.error(`[${AuthService.name}] => Error registering: `, error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      // Only sign out from Firebase if social login is enabled and angularFireAuth is available
      if (this.socialLoginEnabled && this.angularFireAuth) {
        await this.angularFireAuth.signOut();
      }

      await this.storage.remove('accessToken');
      await this.storage.remove('refreshToken');
      await this.storage.remove('tokenExpirationTime');

      // Check if rememberMe is enabled
      const rememberMe = await this.storage.get('rememberMe');

      // If rememberMe is not enabled, remove all saved credentials
      if (!rememberMe) {
        await this.storage.remove('rememberedEmail');
        await this.storage.remove('rememberedPassword');
        await this.storage.remove('rememberMe');
      }
    } catch (error) {
      console.error(`[${AuthService.name}] => Error signing out: `, error);
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await this.storage.get('accessToken');
    if (!token) {
      return false;
    }

    try {
      const response = await this.http
        .get(this.businessOperationsService.checkToken(), {
          headers: { Authorization: `Bearer ${token}` },
        })
        .toPromise();

      return true;
    } catch (error) {
      console.error(
        `[${AuthService.name}] => Error checking if token is valid: `,
        error
      );
      await this.storage.remove('accessToken');
      return false;
    }
  }

  async login(
    type: LoginType,
    email?: string,
    password?: string,
    rememberMe?: boolean
  ): Promise<User> {
    // If social login is not enabled, only allow email/password login
    if (
      !this.socialLoginEnabled &&
      (type === LoginType.GOOGLE ||
        type === LoginType.FACEBOOK ||
        type === LoginType.TWITTER)
    ) {
      throw new Error('Social login is disabled in this environment');
    }

    switch (type) {
      case LoginType.GOOGLE:
        return this.socialLogin(new GoogleAuthProvider());
      case LoginType.FACEBOOK:
        return this.socialLogin(new FacebookAuthProvider());
      case LoginType.TWITTER:
        return this.socialLogin(new TwitterAuthProvider());
      default:
        return this.emailLogin(email, password, rememberMe);
    }
  }

  /**
   * Gets the API URL, with support for temporary URL for debugging
   */
  private getApiUrl(): string {
    // If there's a temporary URL defined (for debugging), use it
    if ((window as any).temporaryApiUrl) {
      console.log(
        'DEBUG - Using temporary API URL:',
        (window as any).temporaryApiUrl
      );
      return (window as any).temporaryApiUrl;
    }

    // Otherwise, use the URL configured in the operations service
    return this.businessOperationsService['_base_url'];
  }

  // Method to verify connectivity with the backend
  async testBackendConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Get the configured main URL
      const apiUrl = this.getApiUrl();
      const testEndpoint = `${apiUrl}/auth/token`;

      console.log('DEBUG - Testing connection to:', testEndpoint);

      // Use fetch for basic connectivity test
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 5000);

      try {
        const response = await fetch(testEndpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
          },
          signal: timeoutController.signal,
        });

        clearTimeout(timeoutId);

        return {
          success: response.ok,
          message: response.ok
            ? 'Connection successful'
            : `Error: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log(
          'DEBUG - Connection test failed for primary URL:',
          fetchError
        );

        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            message: 'Connection timed out after 5 seconds',
            details: { error: 'timeout', url: testEndpoint },
          };
        }

        // Alternative list of URLs to try if the main one fails
        // First check if we have alternative URLs defined in the environment
        const altUrls = (environment as any).apiUrlAlternatives || [
          'http://192.168.1.197:3000',
          'http://192.168.8.1:3000',
          'http://10.0.2.2:3000',
          'http://localhost:3000',
        ];

        // Filter out the main URL to avoid testing it twice
        const filteredUrls = altUrls.filter((url) => !apiUrl.includes(url));

        // Try each alternative URL
        for (const url of filteredUrls) {
          try {
            console.log(`DEBUG - Trying alternative URL: ${url}`);
            const altResponse = await fetch(`${url}/auth/token`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
              },
              // Shorter timeout for alternative URLs
              signal: AbortSignal.timeout(3000),
            });

            if (altResponse.ok) {
              console.log(`DEBUG - Alternative URL worked: ${url}`);
              // Save the URL that worked for future use
              (window as any).temporaryApiUrl = url;

              return {
                success: true,
                message: `Alternative connection successful (${url})`,
                details: {
                  status: altResponse.status,
                  url: url,
                  note: 'Using alternative URL',
                },
              };
            }
          } catch (altError) {
            console.log(`DEBUG - Alternative URL failed: ${url}`, altError);
            // Continue with the next URL
          }
        }

        // If no alternative URL worked
        return {
          success: false,
          message: `Network error: ${fetchError.message}`,
          details: {
            error: fetchError,
            triedUrls: [apiUrl, ...filteredUrls],
            note: 'All URLs failed',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error testing connection: ${error.message}`,
        details: error,
      };
    }
  }

  async emailLogin(
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<User> {
    while (!this.storageReady) {
      await new Promise((res) => setTimeout(res, 10));
    }

    // Run connection test first to ensure API is reachable
    const connectionTest = await this.testBackendConnection();
    console.log('DEBUG - Connection Test Result:', connectionTest);

    // Use the URL that worked if we found one in the connection test
    let baseUrl;
    if (
      connectionTest.success &&
      connectionTest.details &&
      connectionTest.details.url
    ) {
      baseUrl = connectionTest.details.url.replace('/auth/token', '');
    } else {
      baseUrl = this.getApiUrl();
    }

    const loginUrl = `${baseUrl}/auth/login`;

    console.log('DEBUG - NETWORK INFO - Starting login request');
    console.log('DEBUG - NETWORK INFO - URL:', loginUrl);
    console.log(
      'DEBUG - NETWORK INFO - Environment:',
      JSON.stringify({
        production: (window as any).isProduction || false,
        apiUrl: (window as any).apiUrl || 'Not set in window',
        environmentApiUrl: this.businessOperationsService['_base_url'],
        temporaryApiUrl: (window as any).temporaryApiUrl || 'Not set',
      })
    );
    console.log('DEBUG - NETWORK INFO - Login payload:', {
      email,
      password: '******',
      loginType: LoginType.EMAIL_AND_PASSWORD,
    });

    // Try to detect network problems
    try {
      const testUrl = new URL(loginUrl);
      console.log('DEBUG - NETWORK INFO - Hostname:', testUrl.hostname);
      console.log('DEBUG - NETWORK INFO - Protocol:', testUrl.protocol);
      console.log('DEBUG - NETWORK INFO - Port:', testUrl.port);
    } catch (error) {
      console.error('DEBUG - NETWORK INFO - Invalid URL format:', error);
    }

    return new Promise<User>((resolve, reject) => {
      console.log('DEBUG - NETWORK INFO - Sending HTTP request to:', loginUrl);

      // If we are using a temporary URL, make the request directly with fetch
      if ((window as any).temporaryApiUrl) {
        fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            loginType: LoginType.EMAIL_AND_PASSWORD,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('DEBUG - NETWORK INFO - Fetch response:', data);

            try {
              await this.storage.set('accessToken', data.accessToken);
              await this.storage.set('loginType', LoginType.EMAIL_AND_PASSWORD);
              resolve(data.user);
            } catch (err) {
              console.error('DEBUG - Error storing token:', err);
              reject(err);
            }
          })
          .catch((error) => {
            console.error('DEBUG - NETWORK INFO - Fetch error:', error);
            reject(error);
          });
        return;
      }

      // Normal method using HttpClient
      this.http
        .post(loginUrl, {
          email,
          password,
          loginType: LoginType.EMAIL_AND_PASSWORD,
        })
        .subscribe({
          next: async (response: { user: User; accessToken: string }) => {
            try {
              console.log(
                'DEBUG - NETWORK INFO - Login successful, response received'
              );
              console.log(
                'DEBUG - NETWORK INFO - Response data:',
                JSON.stringify(response).substring(0, 100) + '...'
              );

              await this.storage.set('accessToken', response.accessToken);
              await this.storage.set('loginType', LoginType.EMAIL_AND_PASSWORD);

              // Save remember me option
              await this.storage.set('rememberMe', rememberMe);

              // If rememberMe is true, save email and password for future auto-completion
              if (rememberMe) {
                await this.storage.set('rememberedEmail', email);
                // Save the password "securely" (base64)
                // Note: This is not truly secure, but better than plain text
                const encodedPassword = btoa(password);
                await this.storage.set('rememberedPassword', encodedPassword);
              } else {
                // If don't want to remember, remove any previously saved data
                await this.storage.remove('rememberedEmail');
                await this.storage.remove('rememberedPassword');
              } // Small delay to ensure the token is persisted
              await new Promise((res) => setTimeout(res, 100));

              const storedToken = await this.storage.get('accessToken');
              console.log(
                'DEBUG - NETWORK INFO - Token saved successfully:',
                storedToken
                  ? 'Token present (length: ' + storedToken.length + ')'
                  : 'No token saved!'
              );

              resolve(response.user);
            } catch (error) {
              console.error(
                'DEBUG - NETWORK INFO - Error saving token:',
                error
              );
              reject(error);
            }
          },
          error: (error) => {
            console.error('DEBUG - NETWORK INFO - Login request failed');
            console.error('DEBUG - NETWORK INFO - Error status:', error.status);
            console.error(
              'DEBUG - NETWORK INFO - Error message:',
              error.error?.message || 'No error message'
            );
            console.error(
              'DEBUG - NETWORK INFO - Network error type:',
              error.name
            );
            console.error(
              'DEBUG - NETWORK INFO - Full error:',
              JSON.stringify(error, null, 2)
            );

            // Additional debugging information for connection errors
            if (error.name === 'HttpErrorResponse' && error.status === 0) {
              console.error(
                'DEBUG - NETWORK INFO - This appears to be a network connectivity issue'
              );
              console.error('DEBUG - NETWORK INFO - Please check:');
              console.error(
                'DEBUG - NETWORK INFO - 1. Is the backend server running?'
              );
              console.error(
                'DEBUG - NETWORK INFO - 2. Is the device on the same network as the server?'
              );
              console.error(
                'DEBUG - NETWORK INFO - 3. Is the IP address in environment.prod.ts correct?'
              );
              console.error(
                'DEBUG - NETWORK INFO - 4. Are there any firewall issues blocking the connection?'
              );
            }

            reject(error);
          },
        });
    });
  }

  async socialLogin(provider: AuthProvider): Promise<User> {
    // Check if social login is enabled
    if (!this.socialLoginEnabled) {
      throw new Error('Social login is disabled in this environment');
    }

    // Check if angularFireAuth is available
    if (!this.angularFireAuth) {
      throw new Error('Firebase authentication is not available');
    }

    while (!this.storageReady) {
      await new Promise((res) => setTimeout(res, 10));
    }

    try {
      const { user } = await this.angularFireAuth.signInWithPopup(provider);

      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        const accessToken = idTokenResult.token;
        const refreshToken = user.refreshToken;

        await this.storage.set('accessToken', accessToken);
        await this.storage.set('loginType', provider.providerId);
        await this.storage.set('refreshToken', refreshToken);
      }

      const createUserDto = {
        email: user.email,
        authProvider: provider.providerId,
        firstName: user.displayName.split(' ')[0],
        lastName: user.displayName.split(' ')[1],
        profilePictureUrl: user.photoURL,
        firebaseUid: user.uid,
        refreshToken: user.refreshToken,
      };
      this.http
        .post(this.businessOperationsService.login(), {
          email: user.email,
          password: user.uid,
          loginType: provider.providerId,
          createUserDto,
        })
        .subscribe({
          next: async (response: { user: User; accessToken: string }) => {
            await this.storage.set('accessToken', response.accessToken);
          },
          error: (error) => {
            console.error(error);
          },
        });

      return user;
    } catch (error) {
      console.error(
        `[${AuthService.name}] => Error signing in with provider: `,
        error
      );
      if (error.code === 'auth/account-exists-with-different-credential') {
        const email = error.email;
        const pendingCred = error.credential;

        const methods = await this.angularFireAuth.fetchSignInMethodsForEmail(
          email
        );

        if (methods.includes(EmailAuthProvider.PROVIDER_ID)) {
          const password = prompt(
            'Please enter your password to link accounts:'
          );
          const userCredential =
            await this.angularFireAuth.signInWithEmailAndPassword(
              email,
              password
            );
          await userCredential.user.linkWithCredential(pendingCred);
          return userCredential.user;
        } else {
          const provider = this.getProviderForProviderId(methods[0]);
          const result = await this.angularFireAuth.signInWithPopup(provider);
          await result.user.linkWithCredential(pendingCred);
          return result.user;
        }
      } else {
        console.error(
          `[${AuthService.name}] => Error signing in with provider: `,
          error
        );
        return null;
      }
    }
  }

  private getProviderForProviderId(providerId: string): AuthProvider {
    // Check if social login is enabled
    if (!this.socialLoginEnabled) {
      throw new Error('Social login is disabled in this environment');
    }

    switch (providerId) {
      case GoogleAuthProvider.PROVIDER_ID:
        return new GoogleAuthProvider();
      case FacebookAuthProvider.PROVIDER_ID:
        return new FacebookAuthProvider();
      case TwitterAuthProvider.PROVIDER_ID:
        return new TwitterAuthProvider();
      default:
        throw new Error(`No provider available for provider ID: ${providerId}`);
    }
  }

  async sendVerificationEmail() {
    // Check if social login is enabled and Firebase is available
    if (!this.socialLoginEnabled || !this.angularFireAuth) {
      console.warn(
        'Firebase authentication is not available in this environment'
      );
      return Promise.reject(
        new Error('Firebase authentication is not available')
      );
    }

    try {
      return (await this.angularFireAuth.currentUser).sendEmailVerification();
    } catch (error) {
      console.error(
        `[${AuthService.name}] => Error sending verification email: `,
        error
      );
      return Promise.reject(error);
    }
  }

  /**
   * Sends a password reset email to the specified email address
   * @param email The email address to send the reset link to
   * @returns A promise that resolves when the email has been sent
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    // If social login is disabled or Firebase is not available, use the backend API
    if (!this.socialLoginEnabled || !this.angularFireAuth) {
      try {
        // Use backend reset password endpoint
        await this.http
          .post(this.businessOperationsService.resetPassword(), { email })
          .toPromise();

        console.log(`Password reset email sent to ${email} via backend API`);
        return Promise.resolve();
      } catch (error) {
        console.error(
          `[${AuthService.name}] => Error sending password reset email via API: `,
          error
        );

        // If the error is 404, it means the endpoint doesn't exist
        if (error.status === 404) {
          return Promise.reject(
            new Error(
              'Reset password functionality is not implemented in this environment'
            )
          );
        }

        return Promise.reject(error);
      }
    }

    // Use Firebase for password reset if social login is enabled and Firebase is available
    try {
      await this.angularFireAuth.sendPasswordResetEmail(email);
      console.log(`Password reset email sent to ${email} via Firebase`);
      return Promise.resolve();
    } catch (error) {
      console.error(
        `[${AuthService.name}] => Error sending password reset email via Firebase: `,
        error
      );
      return Promise.reject(error);
    }
  }

  /**
   * Resets the user's password using the provided token and new password
   * @param token The reset token from the email
   * @param newPassword The new password to set
   * @returns A promise that resolves when the password has been reset
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await this.http
        .post(this.businessOperationsService.resetPasswordConfirm(), {
          token,
          password: newPassword,
        })
        .toPromise();

      console.log('Password reset successful via backend API');
      return Promise.resolve();
    } catch (error) {
      console.error(
        `[${AuthService.name}] => Error resetting password via API: `,
        error
      );
      return Promise.reject(error);
    }
  }

  /**
   * Checks if the reset password functionality is available in the current environment
   * @returns True if reset password is available, false otherwise
   */
  isResetPasswordAvailable(): boolean {
    // Firebase reset password is available if social login is enabled and angularFireAuth is available
    // Backend reset password is always available because we've implemented it
    return true;
  }

  /**
   * Gets the remembered email if it exists
   * @returns The saved email or null if none exists
   */
  async getRememberedEmail(): Promise<string | null> {
    while (!this.storageReady) {
      await new Promise((res) => setTimeout(res, 10));
    }
    return this.storage.get('rememberedEmail');
  }

  /**
   * Checks if the remember me option is enabled
   * @returns true if enabled, false otherwise
   */
  async isRememberMeEnabled(): Promise<boolean> {
    while (!this.storageReady) {
      await new Promise((res) => setTimeout(res, 10));
    }
    return this.storage.get('rememberMe') || false;
  }

  /**
   * Gets the saved credentials if the rememberMe option is active
   * @returns An object with email, password and rememberMe or null if nothing is saved
   */
  async getSavedCredentials(): Promise<{
    email: string;
    password?: string;
    rememberMe: boolean;
  } | null> {
    while (!this.storageReady) {
      await new Promise((res) => setTimeout(res, 10));
    }

    const rememberedEmail = await this.storage.get('rememberedEmail');
    const rememberedPassword = await this.storage.get('rememberedPassword');
    const rememberMe = await this.storage.get('rememberMe');

    if (rememberedEmail && rememberMe) {
      const credentials: {
        email: string;
        password?: string;
        rememberMe: boolean;
      } = {
        email: rememberedEmail,
        rememberMe: true,
      };

      // Add password if available
      if (rememberedPassword) {
        try {
          // Decode the saved password (base64)
          credentials.password = atob(rememberedPassword);
        } catch (e) {
          console.error('Error decoding saved password:', e);
        }
      }

      return credentials;
    }

    return null;
  }
}
