import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability'
import type { PublicUser } from '../models/user'

/**
 * Available actions in the application
 */
export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete'

/**
 * Available subjects in the application
 */
export type Subject = 'all' | 'User'

/**
 * CASL MongoAbility type for TypeScript safety
 */
export type AppAbility = MongoAbility<[Action, Subject]>

/**
 * Defines abilities for a given user based on their globalRole
 *
 * @param user The user for which to define abilities
 * @returns A CASL Ability instance
 */
export function defineAbilitiesFor(user?: PublicUser) {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  if (user?.globalRole === 'ADMIN') {
    can('manage', 'all')
  } else if (user?.globalRole === 'INSTRUCTOR') {
    // Instructor rules
    can('read', 'all')
    can('manage', 'User', { id: user.id })
  } else if (user?.globalRole === 'USER') {
    // User-specific rules
    can('read', 'all')
    can('manage', 'User', { id: user.id })
  } else {
    // Anonymous/Guest rules
  }

  return build()
}
