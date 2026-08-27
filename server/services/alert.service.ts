/**
 * Push Alert Service (ntfy)
 *
 * Sends operational and event-driven push notifications to administrators
 * via ntfy (https://ntfy.sh or self-hosted instance).
 */

export interface AdminAlert {
  title?: string
  message: string
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'
  tags?: string[]
  clickUrl?: string
}

export interface PassRedemptionAlertData {
  userName?: string | null
  userEmail?: string | null
  passTypeName: string
  assignmentTitle: string
  cost: number
  newDueDate?: Date | null
  courseName?: string | null
}

/**
 * Send an administrative alert to the configured ntfy topic.
 */
export async function sendAdminAlert(alert: AdminAlert): Promise<boolean> {
  const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {}
  const ntfyConfig = (config as any).ntfy || {}
  const serverUrl = (ntfyConfig.serverUrl || 'https://ntfy.sh').replace(/\/+$/, '')
  const topic = ntfyConfig.topic?.trim()
  const token = ntfyConfig.token?.trim()
  const defaultPriority = ntfyConfig.priority || 'default'

  if (!topic) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ntfy] Alert skipped: NUXT_NTFY_TOPIC is not configured.')
    }
    return false
  }

  try {
    const url = `${serverUrl}/${topic}`
    const headers: Record<string, string> = {
      Title: alert.title || 'EGP Broker Alert',
      Priority: alert.priority || defaultPriority
    }

    if (alert.tags && alert.tags.length > 0) {
      headers.Tags = alert.tags.join(',')
    }

    if (alert.clickUrl) {
      headers.Click = alert.clickUrl
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    await $fetch(url, {
      method: 'POST',
      body: alert.message,
      headers
    })

    return true
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[ntfy] Failed to send admin alert:', message)
    return false
  }
}

/**
 * Notify administrator about a pass redemption if alertOnRedemption is enabled.
 */
export async function notifyPassRedemption(data: PassRedemptionAlertData): Promise<boolean> {
  const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {}
  const ntfyConfig = (config as any).ntfy || {}
  const isEnabled =
    String(ntfyConfig.alertOnRedemption) === 'true' || ntfyConfig.alertOnRedemption === true

  if (!isEnabled) {
    return false
  }

  const identity =
    data.userName && data.userEmail
      ? `${data.userName} (${data.userEmail})`
      : data.userName || data.userEmail || 'A student'

  const courseInfo = data.courseName ? ` in ${data.courseName}` : ''
  const dueDateInfo = data.newDueDate
    ? ` New due date: ${data.newDueDate instanceof Date ? data.newDueDate.toISOString() : String(data.newDueDate)}.`
    : ''

  const message = `${identity} redeemed ${data.cost} ${data.passTypeName} pass(es) for "${data.assignmentTitle}"${courseInfo}.${dueDateInfo}`

  return await sendAdminAlert({
    title: `Pass Redeemed: ${data.passTypeName}`,
    message,
    tags: ['ticket', 'admission_tickets']
  })
}
