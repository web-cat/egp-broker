import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGtaInterviewTraining } from '../../../../app/composables/features/useGtaInterviewTraining'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

describe('useGtaInterviewTraining Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with pre-seeded scenario', () => {
    const { activeInterview, expectedArrivals, completedList, feedStatus } =
      useGtaInterviewTraining()

    expect(feedStatus.value).toBe('success')
    expect(activeInterview.value).toBeNull()
    expect(expectedArrivals.value.length).toBeGreaterThanOrEqual(3)

    // Check pre-seeded students
    const studentNames = expectedArrivals.value.map(
      (r) => `${r.student?.firstName} ${r.student?.lastName}`
    )
    expect(studentNames).toContain('Maya Lin')
    expect(studentNames).toContain('Leo Vance')
    expect(studentNames).toContain('Liam Cooper')

    // Shift history has Priya Sharma
    expect(completedList.value.length).toBeGreaterThanOrEqual(1)
    expect(completedList.value[0].student?.firstName).toBe('Priya')
    expect(completedList.value[0].status).toBe('COMPLETED')
  })

  it('checks in a student and sets active interview', async () => {
    const training = useGtaInterviewTraining()
    const target = training.expectedArrivals.value[0]
    const initialExpectedCount = training.expectedArrivals.value.length

    const result = await training.checkIn(target.id)

    expect(result.status).toBe('CHECKED_IN')
    expect(result.checkedInAt).toBeDefined()
    expect(training.activeInterview.value?.id).toBe(target.id)
    expect(training.expectedArrivals.value.length).toBe(initialExpectedCount - 1)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Student Checked In (Training)',
        color: 'success'
      })
    )
  })

  it('saves notes on active interview', async () => {
    const training = useGtaInterviewTraining()
    const target = training.expectedArrivals.value[0]
    await training.checkIn(target.id)

    await training.saveNotes(target.id, 'Good pointer comprehension.')

    expect(training.activeInterview.value?.notes).toBe('Good pointer comprehension.')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Notes Saved (Training)',
        color: 'info'
      })
    )
  })

  it('checks out an active interview and moves to completedList', async () => {
    const training = useGtaInterviewTraining()
    const target = training.expectedArrivals.value[0]
    const initialCompletedCount = training.completedList.value.length

    await training.checkIn(target.id)
    await training.checkOut(target.id, 'Final score 100/100.')

    expect(training.activeInterview.value).toBeNull()
    expect(training.completedList.value.length).toBe(initialCompletedCount + 1)
    const completedRecord = training.completedList.value.find((r) => r.id === target.id)
    expect(completedRecord).toBeDefined()
    expect(completedRecord?.status).toBe('COMPLETED')
    expect(completedRecord?.checkedOutAt).toBeDefined()
    expect(completedRecord?.notes).toBe('Final score 100/100.')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Interview Completed (Training)',
        color: 'success'
      })
    )
  })

  it('marks a student as no-show (MISSED)', async () => {
    const training = useGtaInterviewTraining()
    const target = training.expectedArrivals.value.find((r) => r.student?.firstName === 'Liam')!
    const initialCompletedCount = training.completedList.value.length

    await training.markNoShow(target.id)

    expect(training.expectedArrivals.value.some((r) => r.id === target.id)).toBe(false)
    expect(training.completedList.value.length).toBe(initialCompletedCount + 1)
    const missedRecord = training.completedList.value.find((r) => r.id === target.id)
    expect(missedRecord).toBeDefined()
    expect(missedRecord?.status).toBe('MISSED')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Marked as No-Show (Training)',
        color: 'warning'
      })
    )
  })

  it('resets scenario to initial state', async () => {
    const training = useGtaInterviewTraining()
    const target = training.expectedArrivals.value[0]

    await training.checkIn(target.id)
    await training.checkOut(target.id, 'Finished')
    expect(training.activeInterview.value).toBeNull()

    training.resetScenario()

    expect(training.activeInterview.value).toBeNull()
    expect(training.expectedArrivals.value.length).toBe(3)
    expect(training.completedList.value.length).toBe(1)
    expect(training.expectedArrivals.value.some((r) => r.id === target.id)).toBe(true)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Scenario Reset',
        color: 'info'
      })
    )
  })
})
