import { describe, it, expect } from 'vitest'
import { defineAbilitiesFor } from '@@/shared/utils/abilities'
import type { PublicUser } from '@@/shared/models/user'
import { subject } from '@casl/ability'

describe('CASL Abilities', () => {
    it('should allow ADMIN to manage everything', () => {
        const admin: Partial<PublicUser> = { id: 'admin-1', globalRole: 'ADMIN' }
        const ability = defineAbilitiesFor(admin as PublicUser)

        expect(ability.can('manage', 'all')).toBe(true)
        expect(ability.can('create', 'Post')).toBe(true)
        expect(ability.can('delete', 'User')).toBe(true)
    })

    it('should allow USER to manage their own posts', () => {
        const user: Partial<PublicUser> = { id: 'user-1', globalRole: 'USER' }
        const ability = defineAbilitiesFor(user as PublicUser)

        expect(ability.can('read', 'Post')).toBe(true)
        expect(ability.can('manage', subject('Post', { authorId: 'user-1' } as any))).toBe(true)
        expect(ability.can('manage', subject('Post', { authorId: 'user-2' } as any))).toBe(false)
    })

    it('should allow USER to manage their own profile', () => {
        const user: Partial<PublicUser> = { id: 'user-1', globalRole: 'USER' }
        const ability = defineAbilitiesFor(user as PublicUser)

        expect(ability.can('manage', subject('User', { id: 'user-1' } as any))).toBe(true)
        expect(ability.can('manage', subject('User', { id: 'user-2' } as any))).toBe(false)
    })

    it('should restrict anonymous users to read posts only', () => {
        const ability = defineAbilitiesFor(undefined)

        expect(ability.can('read', 'Post')).toBe(true)
        expect(ability.can('create', 'Post')).toBe(false)
        expect(ability.can('manage', 'all')).toBe(false)
    })
})
