import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminAssignments } from '../../../../app/composables/features/admin/useAdminAssignments'
import { useAdminDeployments } from '../../../../app/composables/features/admin/useAdminDeployments'
import { useAdminPassTypes } from '../../../../app/composables/features/admin/useAdminPassTypes'
import { useAdminPlatforms } from '../../../../app/composables/features/admin/useAdminPlatforms'
import { useAdminGradeTranslations } from '../../../../app/composables/features/admin/useAdminGradeTranslations'
import { useAdminCourses } from '../../../../app/composables/features/admin/useAdminCourses'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('Admin Feature Mutation Composables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAdminAssignments', () => {
    it('creates, updates, and deletes assignments', async () => {
      const { createAssignment, updateAssignment, deleteAssignment } = useAdminAssignments()

      await createAssignment({ title: 'Test' })
      expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments', {
        method: 'POST',
        body: { title: 'Test' }
      })

      await updateAssignment('a-1', { title: 'Updated' })
      expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/a-1', {
        method: 'PATCH',
        body: { title: 'Updated' }
      })

      await deleteAssignment('a-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/assignments/a-1', {
        method: 'DELETE'
      })
    })
  })

  describe('useAdminDeployments', () => {
    it('creates, updates, and deletes deployments', async () => {
      const { createDeployment, updateDeployment, deleteDeployment } = useAdminDeployments()

      await createDeployment({ deploymentId: 'd-1' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/deployments', {
        method: 'POST',
        body: { deploymentId: 'd-1' }
      })

      await updateDeployment('d-1', { deploymentHost: 'host' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/deployments/d-1', {
        method: 'PATCH',
        body: { deploymentHost: 'host' }
      })

      await deleteDeployment('d-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/deployments/d-1', {
        method: 'DELETE'
      })
    })
  })

  describe('useAdminPassTypes', () => {
    it('creates, updates, and deletes pass types', async () => {
      const { createPassType, updatePassType, deletePassType } = useAdminPassTypes()

      await createPassType({ name: 'Late Pass' })
      expect(mockFetch).toHaveBeenCalledWith('/api/me/pass-types', {
        method: 'POST',
        body: { name: 'Late Pass' }
      })

      await updatePassType('pt-1', { name: 'Updated Pass' })
      expect(mockFetch).toHaveBeenCalledWith('/api/me/pass-types/pt-1', {
        method: 'PATCH',
        body: { name: 'Updated Pass' }
      })

      await deletePassType('pt-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/me/pass-types/pt-1', {
        method: 'DELETE'
      })
    })
  })

  describe('useAdminPlatforms', () => {
    it('creates, updates, and deletes platforms', async () => {
      const { createPlatform, updatePlatform, deletePlatform } = useAdminPlatforms()

      await createPlatform({ issuer: 'https://canvas.vt.edu' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/platforms', {
        method: 'POST',
        body: { issuer: 'https://canvas.vt.edu' }
      })

      await updatePlatform('p-1', { name: 'Canvas' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/platforms/p-1', {
        method: 'PATCH',
        body: { name: 'Canvas' }
      })

      await deletePlatform('p-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/platforms/p-1', {
        method: 'DELETE'
      })
    })
  })

  describe('useAdminGradeTranslations', () => {
    it('creates, updates, and deletes grade translations', async () => {
      const { createGradeTranslation, updateGradeTranslation, deleteGradeTranslation } =
        useAdminGradeTranslations()

      await createGradeTranslation({ name: 'Letters' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/grade-translations', {
        method: 'POST',
        body: { name: 'Letters' }
      })

      await updateGradeTranslation('gt-1', { name: 'Letters Updated' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/grade-translations/gt-1', {
        method: 'PATCH',
        body: { name: 'Letters Updated' }
      })

      await deleteGradeTranslation('gt-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/grade-translations/gt-1', {
        method: 'DELETE'
      })
    })
  })

  describe('useAdminCourses', () => {
    it('creates, updates, and deletes courses', async () => {
      const { createCourse, updateCourse, deleteCourse } = useAdminCourses()

      await createCourse({ label: 'CS 1114' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/courses', {
        method: 'POST',
        body: { label: 'CS 1114' }
      })

      await updateCourse('c-1', { label: 'CS 2114' })
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/courses/c-1', {
        method: 'PATCH',
        body: { label: 'CS 2114' }
      })

      await deleteCourse('c-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/courses/c-1', {
        method: 'DELETE'
      })
    })
  })
})
