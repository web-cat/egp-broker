import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

/**
 * Email transporter singleton
 * Creates a single nodemailer transporter instance and reuses it
 */

let transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null
let cachedConfig: ReturnType<typeof useRuntimeConfig> | null = null

/**
 * Validate email configuration
 */
function validateEmailConfig(config: any): void {
  if (!config.email) {
    throw new Error('Email configuration is missing')
  }

  const required = ['host', 'port']
  const missing = required.filter((key) => !config.email[key])

  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`)
  }
}

/**
 * Get or create email transporter
 */
export function getEmailTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
  if (!transporter) {
    try {
      // Cache config on first access
      if (!cachedConfig) {
        cachedConfig = useRuntimeConfig()
        validateEmailConfig(cachedConfig)
      }

      const transportOptions: SMTPTransport.Options = {
        host: cachedConfig.email.host,
        port: cachedConfig.email.port,
        secure: cachedConfig.email.secure
      }

      // Only attach authentication credentials if both user and pass are provided
      if (cachedConfig.email.user && cachedConfig.email.pass) {
        transportOptions.auth = {
          user: cachedConfig.email.user,
          pass: cachedConfig.email.pass
        }
      }

      transporter = nodemailer.createTransport(transportOptions)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create email transporter: ${message}`)
    }
  }

  return transporter
}

/**
 * Reset email transporter singleton (useful for testing or config reloads)
 */
export function resetEmailTransporter(): void {
  transporter = null
  cachedConfig = null
}
