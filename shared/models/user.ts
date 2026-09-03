/**
 * User Model
 *
 * This file contains User-related types, interfaces and validation schemas
 */

import { z } from 'zod'
import { TEXT_FIELD_LIMITS, VALIDATION_PATTERNS } from '@@/shared/constants/validation'

// =============================================================================
// DATABASE ENTITY
// =============================================================================

/**
 * User entity - re-exported from Prisma with serialized dates
 */
import type { User } from '@prisma/client'
export type { User } from '@prisma/client'

/**
 * Public User entity (without sensitive fields)
 */
export type PublicUser = Omit<User, 'password' | 'stripeCustomerId'>

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Factory function to create login schema with i18n messages
 */
export const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .email(t('auth.login.fields.email.validation.invalid'))
      .max(TEXT_FIELD_LIMITS.EMAIL.MAX, t('auth.login.fields.email.validation.maxLength')),
    password: z.string().min(1, t('auth.login.fields.password.validation.required'))
  })

/**
 * Factory function to create registration schema with i18n messages
 */
export const createRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z
        .email(t('auth.register.fields.email.validation.invalid'))
        .max(TEXT_FIELD_LIMITS.EMAIL.MAX, t('auth.register.fields.email.validation.maxLength')),
      password: z
        .string()
        .min(
          TEXT_FIELD_LIMITS.PASSWORD.MIN,
          t('auth.register.fields.password.validation.minLength')
        )
        .max(
          TEXT_FIELD_LIMITS.PASSWORD.MAX,
          t('auth.register.fields.password.validation.maxLength')
        )
        .regex(VALIDATION_PATTERNS.PASSWORD, t('auth.register.fields.password.validation.pattern')),
      confirmPassword: z.string(),
      firstName: z
        .string()
        .min(
          TEXT_FIELD_LIMITS.FIRST_NAME.MIN,
          t('auth.register.fields.firstName.validation.minLength')
        )
        .max(
          TEXT_FIELD_LIMITS.FIRST_NAME.MAX,
          t('auth.register.fields.firstName.validation.maxLength')
        )
        .trim(),
      lastName: z
        .string()
        .min(
          TEXT_FIELD_LIMITS.LAST_NAME.MIN,
          t('auth.register.fields.lastName.validation.minLength')
        )
        .max(
          TEXT_FIELD_LIMITS.LAST_NAME.MAX,
          t('auth.register.fields.lastName.validation.maxLength')
        )
        .trim()
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.register.fields.confirmPassword.validation.match'),
      path: ['confirmPassword']
    })

/**
 * Factory function to create forgot password schema with i18n messages
 */
export const createForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .email(t('auth.forgotPassword.fields.email.validation.invalid'))
      .max(TEXT_FIELD_LIMITS.EMAIL.MAX, t('auth.forgotPassword.fields.email.validation.maxLength'))
  })

/**
 * Factory function to create reset password schema with i18n messages
 */
export const createResetPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      token: z.string().length(64, t('auth.resetPassword.fields.token.validation.length')),
      password: z
        .string()
        .min(
          TEXT_FIELD_LIMITS.PASSWORD.MIN,
          t('auth.resetPassword.fields.password.validation.minLength')
        )
        .max(
          TEXT_FIELD_LIMITS.PASSWORD.MAX,
          t('auth.resetPassword.fields.password.validation.maxLength')
        )
        .regex(
          VALIDATION_PATTERNS.PASSWORD,
          t('auth.resetPassword.fields.password.validation.pattern')
        ),
      confirmPassword: z.string()
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.resetPassword.fields.confirmPassword.validation.match'),
      path: ['confirmPassword']
    })

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type LoginData = z.infer<ReturnType<typeof createLoginSchema>>
export type RegisterData = z.infer<ReturnType<typeof createRegisterSchema>>
export type ForgotPasswordData = z.infer<ReturnType<typeof createForgotPasswordSchema>>
export type ResetPasswordData = z.infer<ReturnType<typeof createResetPasswordSchema>>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialLoginState: LoginData = {
  email: '',
  password: ''
}

export const initialRegisterState: RegisterData = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: ''
}

export const initialForgotPasswordState: ForgotPasswordData = {
  email: ''
}

export const initialResetPasswordState: ResetPasswordData = {
  token: '',
  password: '',
  confirmPassword: ''
}

/**
 * Helper function to convert Prisma User to PublicUser
 */
export function toPublicUser(user: User): PublicUser {
  const { password, ...rest } = user
  return rest
}

// =============================================================================
// ROW SCHEMAS (API Responses)
// =============================================================================

export const userRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  studentId: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  globalRole: z.enum(['ADMIN', 'INSTRUCTOR', 'USER', 'PROCTOR']),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  emailVerified: z.boolean()
})

export type UserRow = z.infer<typeof userRowSchema>
