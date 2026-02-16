import type { SimplePassPool, RedemptionRow } from '@@/shared/models/pass'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'

export const useStudentDashboard = () => {
  // Fetch pass pools for the current course
  const { data: passPools } = useFetch<ApiResponse<SimplePassPool[]>>('/api/me/pass-pools')

  // Fetch assignments for the current course
  const {
    data: assignmentsData,
    status: assignmentsStatus,
    refresh: refreshAssignments
  } = useFetch<ApiResponse<AssignmentRow[]>>('/api/me/assignments')

  // Fetch redemptions for the current course
  const {
    data: redemptionsData,
    status: redemptionsStatus,
    refresh: refreshRedemptions
  } = useFetch<ApiResponse<RedemptionRow[]>>('/api/me/redemptions')

  const redeemPass = async (assignmentId: string, passTypeId: string) => {
    const { data, error } = await useFetch('/api/me/redemptions', {
      method: 'POST',
      body: { assignmentId, passTypeId }
    })

    if (!error.value) {
      // Refresh data after successful redemption
      await Promise.all([refreshAssignments(), refreshRedemptions()])
    }

    return { data, error }
  }

  return {
    passPools,
    assignmentsData,
    assignmentsStatus,
    refreshAssignments,
    redemptionsData,
    redemptionsStatus,
    refreshRedemptions,
    redeemPass
  }
}
