/**
 * Feature Composable: useStudentView
 *
 * Manages the "Student View" preview mode state for instructors,
 * TAs, and administrators to inspect student dashboard interfaces.
 */
export const useStudentView = () => {
  const isStudentView = useState<boolean>('isStudentView', () => false)

  const enterStudentView = () => {
    isStudentView.value = true
  }

  const exitStudentView = () => {
    isStudentView.value = false
  }

  const toggleStudentView = () => {
    isStudentView.value = !isStudentView.value
  }

  return {
    isStudentView,
    enterStudentView,
    exitStudentView,
    toggleStudentView
  }
}
