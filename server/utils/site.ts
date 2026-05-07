import type { H3Event } from 'h3'

/**
 * Resolves the absolute site URL from runtime config, environment variables, or the request.
 *
 * Priority:
 * 1. Runtime config `public.siteUrl` (populated by NUXT_PUBLIC_SITE_URL or NUXT_SITE_URL)
 * 2. Process environment `NUXT_SITE_URL` (direct access fallback)
 * 3. Request headers `host` (with https default)
 * 4. Hardcoded localhost fallback
 */
export function getServerSiteUrl(event: H3Event): string {
  const runtimeConfig = useRuntimeConfig(event)
  const configUrl = runtimeConfig.public.siteUrl as string | undefined

  if (configUrl) {
    return configUrl.replace(/\/$/, '')
  }

  const envUrl = process.env.NUXT_SITE_URL
  if (envUrl) {
    return envUrl.replace(/\/$/, '')
  }

  const host = event.node.req.headers.host
  if (host) {
    // We assume https for deployed environments. 
    // If running locally behind a proxy, this might need further refinement.
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
    return `${protocol}://${host}`
  }

  // Final fallback for local development
  return 'http://localhost:3000'
}
