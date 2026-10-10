import { DEFAULT_TIMEZONE } from '@@/shared/utils/timezone'

export const formatDate = (
  dateString: string | Date | null,
  locale?: string,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (!dateString) return ''

  let currentLocale: { value?: string } | undefined
  try {
    const i18n = useI18n()
    currentLocale = i18n.locale
  } catch {
    // Fallback if called outside Vue setup context
  }
  const finalLocale = locale || currentLocale?.value || 'en-US'

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    if (isNaN(date.getTime())) return ''

    return date.toLocaleDateString(finalLocale, {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return ''
  }
}

export const formatTime = (
  dateString: string | Date | null,
  locale?: string,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (!dateString) return ''

  let currentLocale: { value?: string } | undefined
  try {
    const i18n = useI18n()
    currentLocale = i18n.locale
  } catch {
    // Fallback if called outside Vue setup context
  }
  const finalLocale = locale || currentLocale?.value || 'en-US'

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    if (isNaN(date.getTime())) return typeof dateString === 'string' ? dateString : ''

    return date.toLocaleTimeString(finalLocale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return typeof dateString === 'string' ? dateString : ''
  }
}
