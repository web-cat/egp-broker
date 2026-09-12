import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCbtfProctorTraining } from '../../../../app/composables/features/proctor/useCbtfProctorTraining'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

describe('useCbtfProctorTraining Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with realistic fictional data relative to current time', () => {
    const training = useCbtfProctorTraining()

    expect(training.facility.value.name).toContain('Training Sandbox')
    expect(training.facility.value.totalSeats).toBe(48)
    expect(training.seated.value.length).toBe(2)
    expect(training.arriving.value.length).toBe(3)
    expect(training.departures.value.length).toBe(0)
    expect(training.counts.value).toEqual({
      seated: 2,
      arriving: 3,
      departures: 0
    })
    expect(training.isOnDuty.value).toBe(true)
    expect(training.isMismatchNext.value).toBe(false)
    expect(training.activeArrivalIndex.value).toBe(0)
    expect(training.activeTargetStudent.value?.studentName).toBe('Jane Doe')
  })

  it('cycles through arriving students with advanceArrivalQueue', () => {
    const training = useCbtfProctorTraining()

    expect(training.activeArrivalIndex.value).toBe(0)
    expect(training.activeTargetStudent.value?.studentName).toBe('Jane Doe')

    training.advanceArrivalQueue()
    expect(training.activeArrivalIndex.value).toBe(1)
    expect(training.activeTargetStudent.value?.studentName).toBe('Marcus Vance')

    training.advanceArrivalQueue()
    expect(training.activeArrivalIndex.value).toBe(2)
    expect(training.activeTargetStudent.value?.studentName).toBe('Elena Rostova')

    // Wraps around
    training.advanceArrivalQueue()
    expect(training.activeArrivalIndex.value).toBe(0)
    expect(training.activeTargetStudent.value?.studentName).toBe('Jane Doe')
  })

  it('allows jumping directly to a specific arrival index or student', () => {
    const training = useCbtfProctorTraining()
    training.selectArrivalIndex(2)
    expect(training.activeArrivalIndex.value).toBe(2)
    expect(training.activeTargetStudent.value?.studentName).toBe('Elena Rostova')
  })

  it('looks up active on-time student with real card swipe input', async () => {
    const training = useCbtfProctorTraining()
    training.selectArrivalIndex(0) // Jane Doe (on-time / standard)

    // Simulate scanning arbitrary real student ID card
    const result = await training.lookupStudent(';9876543210=2812?')

    expect(result).not.toBeNull()
    expect(result?.found).toBe(true)
    expect(result?.student?.firstName).toBe('Jane')
    expect(result?.decision).toBe('READY_FOR_CHECKIN')
    expect(training.lookupResult.value?.decision).toBe('READY_FOR_CHECKIN')
  })

  it('simulates turn-away mismatch when isMismatchNext is toggled', async () => {
    const training = useCbtfProctorTraining()
    training.toggleMismatchNext(true)
    expect(training.isMismatchNext.value).toBe(true)

    // Scan card
    const result = await training.lookupStudent(';9999999999=1234?')

    expect(result?.decision).toBe('NO_ACTIVE_RESERVATION')
    expect(result?.found).toBe(false)
    expect(result?.message).toContain('No scheduled exam reservations found')
    // Must auto-reset mismatch toggle
    expect(training.isMismatchNext.value).toBe(false)
  })

  it('identifies early arrival decision when early student is queued', async () => {
    const training = useCbtfProctorTraining()
    training.selectArrivalIndex(1) // Marcus Vance (scheduled in 45m)

    const result = await training.lookupStudent('any-id-string')
    expect(result?.decision).toBe('EARLY')
    expect(result?.message).toContain('Too early to check in')
  })

  it('identifies late arrival decision when late student is queued', async () => {
    const training = useCbtfProctorTraining()
    training.selectArrivalIndex(2) // Elena Rostova (scheduled 25m ago)

    const result = await training.lookupStudent('any-id-string')
    expect(result?.decision).toBe('LATE')
    expect(result?.message).toContain('Proctor override required')
  })

  it('confirms check-in: moves student to seated, updates counts, and sets lastAction', async () => {
    const training = useCbtfProctorTraining()
    training.selectArrivalIndex(0)
    await training.lookupStudent('test-swipe')

    const resId = training.lookupResult.value?.reservation?.id
    expect(resId).toBeTruthy()

    await training.confirmCheckIn(resId!)

    expect(training.arriving.value.length).toBe(2)
    expect(training.seated.value.length).toBe(3)
    expect(training.counts.value.seated).toBe(3)
    expect(training.counts.value.arriving).toBe(2)
    expect(training.lastAction.value?.type).toBe('checkin')
    expect(training.lastAction.value?.message).toContain('Checked in Jane Doe')
    expect(training.lookupResult.value).toBeNull()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Checked In: Jane Doe'),
        color: 'success'
      })
    )
  })

  it('confirms check-out: moves student to departures, updates counts and lastAction', async () => {
    const training = useCbtfProctorTraining()
    const seatedStudent = training.seated.value[0]
    expect(seatedStudent).toBeTruthy()

    await training.confirmCheckOut(seatedStudent.id)

    expect(training.seated.value.length).toBe(1)
    expect(training.departures.value.length).toBe(1)
    expect(training.counts.value.seated).toBe(1)
    expect(training.counts.value.departures).toBe(1)
    expect(training.lastAction.value?.type).toBe('checkout')
    expect(training.lastAction.value?.message).toContain('RETURN student ID')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Checked Out:'), color: 'info' })
    )
  })

  it('logs incident notes on a seated student in memory', async () => {
    const training = useCbtfProctorTraining()
    const seatedStudent = training.seated.value[0]

    await training.addNote({
      reservationId: seatedStudent.id,
      content: 'Student dropped pen and requested replacement.'
    })

    const updated = training.seated.value.find((s) => s.id === seatedStudent.id)
    expect(updated?.noteCount).toBe(1)
    expect(updated?.notes?.length).toBe(1)
    expect(updated?.notes?.[0].content).toBe('Student dropped pen and requested replacement.')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Incident Note Logged', color: 'warning' })
    )
  })

  it('toggles proctor duty status in training mode', async () => {
    const training = useCbtfProctorTraining()
    expect(training.isOnDuty.value).toBe(true)

    await training.toggleDuty(false)
    expect(training.isOnDuty.value).toBe(false)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Checked Off Duty' })
    )

    await training.toggleDuty(true)
    expect(training.isOnDuty.value).toBe(true)
  })

  it('resets scenario back to initial state cleanly', async () => {
    const training = useCbtfProctorTraining()

    // Perform check-in and check-out to alter state
    training.selectArrivalIndex(0)
    await training.lookupStudent('test')
    await training.confirmCheckIn(training.lookupResult.value!.reservation!.id)
    await training.confirmCheckOut(training.seated.value[0].id)
    training.toggleMismatchNext(true)

    expect(training.seated.value.length).toBe(2)
    expect(training.arriving.value.length).toBe(2)
    expect(training.departures.value.length).toBe(1)

    // Now reset
    training.resetScenario()

    expect(training.seated.value.length).toBe(2)
    expect(training.arriving.value.length).toBe(3)
    expect(training.departures.value.length).toBe(0)
    expect(training.counts.value).toEqual({ seated: 2, arriving: 3, departures: 0 })
    expect(training.activeArrivalIndex.value).toBe(0)
    expect(training.isMismatchNext.value).toBe(false)
    expect(training.lastAction.value).toBeNull()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Training Scenario Reset' })
    )
  })
})
