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

export interface PassPortSyncFailureAlertData {
  toolName: string
  assignmentTitle: string
  courseLabel?: string | null
  studentName?: string | null
  studentEmail?: string | null
  error: string
  requestId?: string
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

/**
 * Notify administrator about a PassPort extension sync failure.
 * This is an urgent operational alert triggered when an external tool fails to accept an extension webhook.
 */
export async function notifyPassPortSyncFailure(
  data: PassPortSyncFailureAlertData
): Promise<boolean> {
  const identity =
    data.studentName && data.studentEmail
      ? `${data.studentName} (${data.studentEmail})`
      : data.studentName || data.studentEmail || 'A student'

  const courseInfo = data.courseLabel ? ` in ${data.courseLabel}` : ''
  const reqInfo = data.requestId ? ` (Request ID: ${data.requestId})` : ''

  const message = `PassPort extension sync failed for ${identity}${courseInfo} on assignment "${data.assignmentTitle}" with external tool "${data.toolName}".\nError: ${data.error}${reqInfo}`

  return await sendAdminAlert({
    title: `PassPort Sync Failure: ${data.toolName}`,
    message,
    priority: 'urgent',
    tags: ['warning', 'passport', 'rotating_light']
  })
}

export interface CbtfCanvasOverrideFailureAlertData {
  assignmentTitle: string
  courseLabel?: string | null
  studentName?: string | null
  studentEmail?: string | null
  timeSlot: string
  error: string
}

/**
 * Notify administrator about a CBTF Canvas override sync failure.
 */
export async function notifyCbtfCanvasOverrideFailure(
  data: CbtfCanvasOverrideFailureAlertData
): Promise<boolean> {
  const identity =
    data.studentName && data.studentEmail
      ? `${data.studentName} (${data.studentEmail})`
      : data.studentName || data.studentEmail || 'A student'

  const courseInfo = data.courseLabel ? ` in ${data.courseLabel}` : ''

  const message = `CBTF Canvas override sync failed for ${identity}${courseInfo} on assignment "${data.assignmentTitle}" for slot ${data.timeSlot}.\nError: ${data.error}`

  return await sendAdminAlert({
    title: `CBTF Canvas Override Failure: ${data.assignmentTitle}`,
    message,
    priority: 'high',
    tags: ['warning', 'cbtf', 'canvas', 'rotating_light']
  })
}

export interface CbtfScheduleSuccessAlertData {
  studentName?: string | null
  studentEmail?: string | null
  studentId?: string | null
  assignmentTitle?: string | null
  courseLabel?: string | null
  startTime: string | Date
  endTime?: string | Date | null
  seatNumber?: number | null
  facilityName?: string | null
  isReschedule?: boolean
}

export interface CbtfScheduleFailureAlertData {
  studentName?: string | null
  studentEmail?: string | null
  studentId?: string | null
  assignmentTitle?: string | null
  courseLabel?: string | null
  timeSlot?: string | Date | null
  errorType: string
  errorMessage: string
  errorLocation: string
  isReschedule?: boolean
}

function formatStudentIdentity(data: {
  studentName?: string | null
  studentEmail?: string | null
  studentId?: string | null
}): string {
  const parts: string[] = []
  if (data.studentName) parts.push(data.studentName)
  if (data.studentEmail) parts.push(`<${data.studentEmail}>`)
  if (data.studentId) parts.push(`[ID: ${data.studentId}]`)

  if (parts.length > 0) {
    return parts.join(' ')
  }
  return 'A student'
}

function formatTimeSlot(start: string | Date, end?: string | Date | null): string {
  const startStr = start instanceof Date ? start.toISOString() : String(start)
  if (!end) return startStr
  const endStr = end instanceof Date ? end.toISOString() : String(end)
  return `${startStr} to ${endStr}`
}

/**
 * Notify administrator about a successful CBTF reservation booking or reschedule.
 */
export async function notifyCbtfScheduleSuccess(
  data: CbtfScheduleSuccessAlertData
): Promise<boolean> {
  const identity = formatStudentIdentity(data)
  const slotStr = formatTimeSlot(data.startTime, data.endTime)
  const action = data.isReschedule ? 'rescheduled' : 'scheduled'
  const actionCapitalized = data.isReschedule ? 'Rescheduled' : 'Scheduled'
  const assignment = data.assignmentTitle ? ` for "${data.assignmentTitle}"` : ''
  const course = data.courseLabel ? ` in ${data.courseLabel}` : ''
  const seat = data.seatNumber ? `\nSeat: #${data.seatNumber}` : ''
  const facility = data.facilityName ? `\nFacility: ${data.facilityName}` : ''

  const message = `${identity} ${action} a CBTF exam slot${assignment}${course}.\nTime: ${slotStr}${seat}${facility}`

  return await sendAdminAlert({
    title: `CBTF Slot ${actionCapitalized}: ${data.assignmentTitle || 'Exam'}`,
    message,
    priority: 'default',
    tags: ['calendar', 'cbtf', 'white_check_mark']
  })
}

/**
 * Notify administrator about a failed CBTF reservation booking or reschedule attempt.
 */
export async function notifyCbtfScheduleFailure(
  data: CbtfScheduleFailureAlertData
): Promise<boolean> {
  const identity = formatStudentIdentity(data)
  const action = data.isReschedule ? 'reschedule' : 'schedule'
  const slotInfo = data.timeSlot ? `\nRequested Slot: ${formatTimeSlot(data.timeSlot)}` : ''
  const assignmentInfo = data.assignmentTitle ? `\nAssignment: "${data.assignmentTitle}"` : ''
  const courseInfo = data.courseLabel ? ` in ${data.courseLabel}` : ''

  const message = `Failed CBTF ${action} attempt by ${identity}${assignmentInfo}${courseInfo}.${slotInfo}\n\nError Type: ${data.errorType}\nMessage: ${data.errorMessage}\nLocation: ${data.errorLocation}`

  return await sendAdminAlert({
    title: `CBTF Scheduling Error: ${data.assignmentTitle || 'Reservation Failed'}`,
    message,
    priority: 'high',
    tags: ['warning', 'cbtf', 'x', 'rotating_light']
  })
}

export interface ProctorNoteAlertData {
  studentName?: string | null
  studentEmail?: string | null
  studentId?: string | null
  assignmentTitle?: string | null
  courseLabel?: string | null
  startTime?: string | Date | null
  seatNumber?: number | null
  authorName?: string | null
  content: string
  hasPhotos?: boolean
}

/**
 * Notify administrator about a proctor note entered for a CBTF reservation.
 */
export async function notifyProctorNote(data: ProctorNoteAlertData): Promise<boolean> {
  const identity = formatStudentIdentity(data)
  const assignment = data.assignmentTitle ? ` for "${data.assignmentTitle}"` : ''
  const course = data.courseLabel ? ` in ${data.courseLabel}` : ''
  const startStr = data.startTime
    ? data.startTime instanceof Date
      ? data.startTime.toISOString()
      : String(data.startTime)
    : 'Unknown'
  const seat = data.seatNumber ? `\nSeat: #${data.seatNumber}` : ''
  const proctor = data.authorName ? `\nProctor: ${data.authorName}` : ''
  const photos = data.hasPhotos ? '\nPhotos: Attached / Captured' : ''

  const message = `Proctor note entered for ${identity}${assignment}${course}.\nReservation Start Time: ${startStr}${seat}${proctor}${photos}\n\nNote:\n${data.content}`

  const title = data.studentName
    ? `Proctor Note: ${data.studentName} (${data.assignmentTitle || 'CBTF Exam'})`
    : `Proctor Note: ${data.assignmentTitle || 'CBTF Exam'}`

  return await sendAdminAlert({
    title,
    message,
    priority: 'default',
    tags: ['memo', 'cbtf']
  })
}
