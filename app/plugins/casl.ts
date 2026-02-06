import { abilitiesPlugin } from '@casl/vue'
import { defineAbilitiesFor } from '@@/shared/utils/abilities'
import type { PublicUser } from '@@/shared/models/user'

export default defineNuxtPlugin((nuxtApp) => {
    const { loggedIn, user } = useUserSession()

    // Initialize ability based on current logged in user
    // useUserSession returns a Ref for user, but defineAbilitiesFor expects a POJO
    const ability = defineAbilitiesFor(user.value as PublicUser | undefined)

    // Watch for session changes to update abilities
    watch(user as Ref<PublicUser | null>, (newUser) => {
        ability.update(defineAbilitiesFor(newUser || undefined).rules)
    })

    nuxtApp.vueApp.use(abilitiesPlugin, ability, {
        useGlobalAbility: true
    })

    return {
        provide: {
            ability
        }
    }
})
