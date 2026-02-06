import { useAbility as useCaslAbility } from '@casl/vue'
import type { AppAbility } from '@@/shared/utils/abilities'

/**
 * Composable to access the user's CASL ability
 *
 * Provides `can` and `cannot` methods for permission checks:
 * const { can } = useAbility()
 * if (can('delete', 'Post')) { ... }
 */
export const useAbility = () => {
  return useCaslAbility<AppAbility>()
}
