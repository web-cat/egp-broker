export default defineNuxtRouteMiddleware(() => {
  const config = useRuntimeConfig()
  const localePath = useLocalePath()

  if (!config.public.enablePasswordLogin) {
    return navigateTo(localePath('/'))
  }
})
