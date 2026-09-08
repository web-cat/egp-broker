export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    // Ignore 404s for static chunks or missing routes to avoid log flooding
    const statusCode = (error as any)?.statusCode || (error as any)?.status
    if (statusCode === 404 || event?.path?.startsWith('/_nuxt/')) {
      return
    }

    console.error('--- NITRO GLOBAL ERROR CATCH ---')
    console.error('Path:', event?.path)
    console.error('Error Name:', error.name)
    console.error('Error Message:', error.message)
    console.error('Stack Trace:', error.stack)
  })
})
