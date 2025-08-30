export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  authProvider: string;
}
