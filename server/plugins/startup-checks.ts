/**
 * Startup validation plugin.
 *
 * In production, verifies that required email configuration keys are present
 * before the server begins handling requests. Fails fast rather than silently
 * dropping emails later.
 */
export default function startupChecksPlugin(_nitro: any) {
  if (process.env.NODE_ENV !== 'production') return

  const config = useRuntimeConfig()
  const required: Array<keyof typeof config.email> = ['host', 'user', 'pass', 'from']
  const missing = required.filter((key) => !config.email[key])

  if (missing.length > 0) {
    const keys = missing.map((k) => `NUXT_EMAIL_${k.toUpperCase()}`).join(', ')
    console.error(`[startup] Missing required email configuration: ${keys}. Email sending will fail.`)
  }
}
