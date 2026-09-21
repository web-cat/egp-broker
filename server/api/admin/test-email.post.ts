import { defineEventHandler, createError } from 'h3'
import { getEmailTransporter } from '@@/server/utils/email-transporter.helpers'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(
  async (event): Promise<ApiResponse<{ success: boolean; email: string }>> => {
    const session = await getUserSession(event)

    if (!session.user || session.user.globalRole !== 'ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    const recipientEmail = session.user.email?.trim()
    if (!recipientEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Current user has no email address configured'
      })
    }

    const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : ({} as any)
    const fromEmail = config.email?.from || 'noreply@example.edu'
    const transporter = getEmailTransporter()

    const userName =
      `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Administrator'
    const timestamp = new Date().toLocaleString()

    const subject = '[EGP Broker] Email Configuration Test'
    const text = `Hello ${userName},

This is an automated test message sent from the EGP Broker Admin Dashboard.
Your email system is properly configured and operational.

Timestamp: ${timestamp}
Recipient: ${recipientEmail}
Sent by: ${fromEmail}
`.trim()

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
      <h2 style="color: #2563eb; margin-top: 0;">EGP Broker Email Test</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>This is an automated test message sent from the <strong>Admin Dashboard</strong> to verify your mail delivery configuration.</p>
      <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Status:</strong> Operational</p>
        <p style="margin: 4px 0;"><strong>Recipient:</strong> ${recipientEmail}</p>
        <p style="margin: 4px 0;"><strong>Sender:</strong> ${fromEmail}</p>
        <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${timestamp}</p>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">If you did not initiate this test, please review your administrator account security.</p>
    </div>
  `.trim()

    try {
      await transporter.sendMail({
        from: `"EGP Broker Admin" <${fromEmail}>`,
        to: recipientEmail,
        subject,
        text,
        html
      })
    } catch (err: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to dispatch test email: ${err?.message || 'Mail transport error'}`
      })
    }

    return {
      statusCode: 200,
      data: {
        success: true,
        email: recipientEmail
      }
    }
  }
)
