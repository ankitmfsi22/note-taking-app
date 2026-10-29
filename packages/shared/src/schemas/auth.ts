import { z } from 'zod';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  OTP_LENGTH,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../constants/limits.js';
import { IdSchema } from './common.js';

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX));

export const NewPasswordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .regex(/\p{L}/u, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one digit');

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: NewPasswordSchema,
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX).optional(),
});

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordRequestSchema = z.object({
  email: EmailSchema,
  otp: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `OTP must be ${OTP_LENGTH} digits`),
  newPassword: NewPasswordSchema,
});

export const PublicUserSchema = z.object({
  id: IdSchema,
  email: z.string(),
  displayName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
  accessToken: z.string(),
  expiresIn: z.literal(ACCESS_TOKEN_TTL_SECONDS),
});
