/**
 * Composable for child admin pages to override the header title
 * displayed by the parent admin.vue layout.
 *
 * Usage in child page:
 *   const { setTitle } = useAdminPageTitle()
 *   setTitle('Assignments: CS 101 — Intro to CS')
 *
 * The parent admin.vue reads the reactive title and falls back to the default.
 */
export function useAdminPageTitle() {
  const title = useState<string | null>('admin-page-title', () => null)

  function setTitle(value: string | null) {
    title.value = value
  }

  // Reset title when the composable's component unmounts,
  // so navigating away clears the override.
  onUnmounted(() => {
    title.value = null
  })

  return { title, setTitle }
}
