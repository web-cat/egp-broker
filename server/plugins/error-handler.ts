export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    console.error('--- NITRO GLOBAL ERROR CATCH ---')
    console.error('Path:', event?.path)
    console.error('Error Name:', error.name)
    console.error('Error Message:', error.message)
    console.error('Stack Trace:', error.stack)
  })
})