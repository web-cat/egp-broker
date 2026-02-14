To finalize your setup, here is a practical look at how these principles manifest in code. By enforcing these boundaries now, you ensure that as the project grows, a change to a database field or an API endpoint won't require a "search and replace" across your entire `pages/` directory.

### Implementation Example: The "Feature Composable" Pattern

Instead of calling `useFetch('/api/user/profile')` inside a component, we use a dedicated composable to act as the **Single Source of Truth** for that data's transport.

```typescript
// app/composables/useUserProfile.ts
export const useUserProfile = () => {
  // Logic is isolated; the component doesn't care about the URL or the method
  const { data, error, refresh } = useFetch('/api/v1/user/profile', {
    key: 'user-profile',
    transform: (data) => {
      // Logic Isolation: Format data here, not in the Vue template
      return {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`
      }
    }
  })

  return { profile: data, error, refresh }
}
```

---

### Implementation Example: Component Taxonomy

By strictly separating **Base** from **Feature** components, you allow new developers to identify high-risk versus low-risk areas of the UI.

| Category    | Location                   | Responsibility                          | Constraint                                        |
| ----------- | -------------------------- | --------------------------------------- | ------------------------------------------------- |
| **Base**    | `app/components/base/`     | Generic UI (Button, Modal, Input)       | **No** imports from stores or composables.        |
| **Feature** | `app/components/features/` | Domain logic (UserDashboard, GradeList) | **Allowed** to use Pinia and Feature Composables. |

---

### Implementation Example: Shared Truths

To ensure **Type Safety** across the stack, we define Zod schemas in the `shared/` directory. This allows the server to validate input and the client to know exactly what the response looks like.

```typescript
// shared/models/user.ts
import { z } from 'zod'

export const UserUpdateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'USER', 'GUEST'])
})

export type UserUpdate = z.infer<typeof UserUpdateSchema>
```
