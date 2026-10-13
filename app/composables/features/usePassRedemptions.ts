import type { ApiResponse } from '@@/shared/types/api'
import type {
  AssignmentRedemptionRow,
  StudentRedemptionHistoryRow,
  StudentPassBalance,
  StudentInterviewHistoryRow,
  TeacherForceRedeemPassResponse
} from '@@/shared/models/teacher'
import type { AssignmentOverrideDetails } from '@@/shared/models/override'
import type { AssignmentRow } from '@@/shared/models/assignment'
import type { CbtfAssignmentReservationSummary, CbtfReservationDto } from '@@/shared/models/cbtf'

export function usePassRedemptions() {
  const syncPassport = async (
    assignmentId: string
  ): Promise<{ data: { syncedCount: number; failedCount: number; totalCount: number } }> => {
    return $fetch<{
      data: { syncedCount: number; failedCount: number; totalCount: number }
    }>(`/api/me/assignments/${assignmentId}/passport-sync`, {
      method: 'POST'
    })
  }

  const fetchAssignmentRedemptions = async (
    assignmentId: string
  ): Promise<{ data: AssignmentRedemptionRow[] }> => {
    return $fetch<{ data: AssignmentRedemptionRow[] }>(
      `/api/me/assignments/${assignmentId}/redemptions`
    )
  }

  const fetchAssignmentOverrides = async (
    assignmentId: string
  ): Promise<{ data: AssignmentOverrideDetails[] }> => {
    return $fetch<{ data: AssignmentOverrideDetails[] }>(
      `/api/me/assignments/${assignmentId}/overrides`
    )
  }

  const fetchAssignmentCbtfSummary = async (
    assignmentId: string
  ): Promise<{ data: CbtfAssignmentReservationSummary | null }> => {
    return $fetch<{ data: CbtfAssignmentReservationSummary }>(
      `/api/me/assignments/${assignmentId}/cbtf-reservation-summary`
    )
  }

  const fetchAssignments = async (): Promise<ApiResponse<AssignmentRow[]>> => {
    return $fetch<ApiResponse<AssignmentRow[]>>('/api/me/assignments')
  }

  const updateStudentPassBalances = async (
    studentId: string,
    balances: { passTypeId: string; balance: number }[]
  ): Promise<ApiResponse<StudentPassBalance[]>> => {
    return $fetch<ApiResponse<StudentPassBalance[]>>(`/api/me/students/${studentId}/pass-pools`, {
      method: 'PATCH',
      body: { balances }
    })
  }

  const fetchStudentRedemptions = async (
    studentId: string
  ): Promise<{ data: StudentRedemptionHistoryRow[] }> => {
    return $fetch<{ data: StudentRedemptionHistoryRow[] }>(
      `/api/me/students/${studentId}/redemptions`
    )
  }

  const fetchStudentInterviews = async (
    studentId: string,
    courseId?: string | null
  ): Promise<{ data: StudentInterviewHistoryRow[] }> => {
    const url = courseId
      ? `/api/me/students/${studentId}/interviews?courseId=${courseId}`
      : `/api/me/students/${studentId}/interviews`
    return $fetch<{ data: StudentInterviewHistoryRow[] }>(url)
  }

  const fetchStudentCbtfReservations = async (
    studentId: string,
    courseId?: string | null
  ): Promise<{ data: CbtfReservationDto[] }> => {
    const url = courseId
      ? `/api/me/students/${studentId}/cbtf-reservations?courseId=${courseId}`
      : `/api/me/students/${studentId}/cbtf-reservations`
    return $fetch<{ data: CbtfReservationDto[] }>(url)
  }

  const forceRedeemStudentPass = async (
    studentId: string,
    payload: unknown
  ): Promise<ApiResponse<TeacherForceRedeemPassResponse>> => {
    return $fetch<ApiResponse<TeacherForceRedeemPassResponse>>(
      `/api/me/students/${studentId}/redemptions`,
      {
        method: 'POST',
        body: payload
      }
    )
  }

  return {
    syncPassport,
    fetchAssignmentRedemptions,
    fetchAssignmentOverrides,
    fetchAssignmentCbtfSummary,
    fetchAssignments,
    updateStudentPassBalances,
    fetchStudentRedemptions,
    fetchStudentInterviews,
    fetchStudentCbtfReservations,
    forceRedeemStudentPass
  }
}
