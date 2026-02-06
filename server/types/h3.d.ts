import type { AppAbility } from '@@/shared/utils/abilities'
import type { PublicUser } from '@@/shared/models/user'

declare module 'h3' {
  interface H3EventContext {
    user?: PublicUser
    ability?: AppAbility
  }
}

export {}
