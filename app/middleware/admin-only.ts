export default defineNuxtRouteMiddleware(async () => {
  const { user, fetch: fetchSession } = useUserSession()

  // Ensure session is fresh
  if (!user.value) {
    await fetchSession()
  }

  if (!user.value || user.value.globalRole !== 'ADMIN') {
    return navigateTo('/')
  }
})
