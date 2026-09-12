import { ref, computed } from 'vue'
import { parseCardSwipe } from '~/utils/cardSwipe'

export interface FictionalStudent {
  id: string
  firstName: string
  lastName: string
  studentId: string
  avatarUrl: string | null
}

export interface FictionalReservation {
  id: string
  seatNumber?: number
  studentName: string
  studentId: string
  assignmentTitle: string
  startTime: string
  endTime: string
  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT'
  elapsedMinutes?: number
  remainingMinutes?: number
  noteCount?: number
  notes?: Array<{
    id: string
    content: string
    createdAt: string
    author?: { firstName: string; lastName: string }
  }>
  student?: FictionalStudent
}

export function useCbtfProctorTraining() {
  const toast = useToast()

  const isOnDuty = ref(true)
  const isMismatchNext = ref(false)
  const activeArrivalIndex = ref(0)

  const lookupResult = ref<any | null>(null)
  const lookupLoading = ref(false)
  const lookupError = ref<string | null>(null)
  const lastAction = ref<{ message: string; type: 'checkin' | 'checkout'; time: Date } | null>(null)

  // Note Modal State
  const isNoteModalOpen = ref(false)
  const selectedNoteTarget = ref<{
    reservationId?: string
    seatNumber?: number
    studentName?: string
    assignmentTitle?: string
    notes?: any[]
  } | null>(null)

  // Facility Settings
  const facility = ref({
    id: 'fac-training-sandbox',
    name: 'CBTF Main Lab (Training Sandbox)',
    totalSeats: 48,
    occupiedSeats: 2,
    availableSeats: 46,
    checkInLeadMinutes: 10,
    checkInGraceMinutes: 15
  })

  const seated = ref<FictionalReservation[]>([])
  const arriving = ref<FictionalReservation[]>([])
  const departures = ref<FictionalReservation[]>([])

  const feedStatus = ref('success')
  const refreshFeed = async () => {
    // In-memory noop to satisfy interface
  }

  // Generate dynamic relative dates
  const buildInitialScenario = () => {
    const now = new Date()

    // 1. Standard Arrival (starts in 3 mins -> within 10 min lead window -> READY_FOR_CHECKIN)
    const stdStart = new Date(now.getTime() + 3 * 60000)
    const stdEnd = new Date(now.getTime() + 63 * 60000)

    // 2. Early Arrival (starts in 45 mins -> > 10 min lead window -> EARLY)
    const earlyStart = new Date(now.getTime() + 45 * 60000)
    const earlyEnd = new Date(now.getTime() + 105 * 60000)

    // 3. Late Arrival (started 25 mins ago -> > 15 min grace window -> LATE)
    const lateStart = new Date(now.getTime() - 25 * 60000)
    const lateEnd = new Date(now.getTime() + 35 * 60000)

    // 4. Seated Student 1 (started 30m ago, 45m left)
    const seated1Start = new Date(now.getTime() - 30 * 60000)
    const seated1End = new Date(now.getTime() + 45 * 60000)

    // 5. Seated Student 2 (started 50m ago, 7m left -> urgent / ending soon)
    const seated2Start = new Date(now.getTime() - 50 * 60000)
    const seated2End = new Date(now.getTime() + 7 * 60000)

    arriving.value = [
      {
        id: 'train-res-std',
        seatNumber: undefined,
        studentName: 'Jane Doe',
        studentId: '900000001',
        assignmentTitle: 'CS 101: Midterm Exam 1',
        startTime: stdStart.toISOString(),
        endTime: stdEnd.toISOString(),
        status: 'SCHEDULED',
        notes: [],
        student: {
          id: 'train-usr-1',
          firstName: 'Jane',
          lastName: 'Doe',
          studentId: '900000001',
          avatarUrl: null
        }
      },
      {
        id: 'train-res-early',
        seatNumber: undefined,
        studentName: 'Marcus Vance',
        studentId: '900000002',
        assignmentTitle: 'PHYS 211: Quiz 3',
        startTime: earlyStart.toISOString(),
        endTime: earlyEnd.toISOString(),
        status: 'SCHEDULED',
        notes: [],
        student: {
          id: 'train-usr-2',
          firstName: 'Marcus',
          lastName: 'Vance',
          studentId: '900000002',
          avatarUrl: null
        }
      },
      {
        id: 'train-res-late',
        seatNumber: undefined,
        studentName: 'Elena Rostova',
        studentId: '900000003',
        assignmentTitle: 'MATH 241: Exam 2',
        startTime: lateStart.toISOString(),
        endTime: lateEnd.toISOString(),
        status: 'SCHEDULED',
        notes: [],
        student: {
          id: 'train-usr-3',
          firstName: 'Elena',
          lastName: 'Rostova',
          studentId: '900000003',
          avatarUrl: null
        }
      }
    ]

    seated.value = [
      {
        id: 'train-res-seated-1',
        seatNumber: 4,
        studentName: 'David Chen',
        studentId: '900000004',
        assignmentTitle: 'ECE 120: Final Assessment',
        startTime: seated1Start.toISOString(),
        endTime: seated1End.toISOString(),
        status: 'CHECKED_IN',
        elapsedMinutes: 30,
        remainingMinutes: 45,
        noteCount: 0,
        notes: [],
        student: {
          id: 'train-usr-4',
          firstName: 'David',
          lastName: 'Chen',
          studentId: '900000004',
          avatarUrl: null
        }
      },
      {
        id: 'train-res-seated-2',
        seatNumber: 12,
        studentName: 'Aaliyah Patel',
        studentId: '900000005',
        assignmentTitle: 'STAT 400: Lab Practical',
        startTime: seated2Start.toISOString(),
        endTime: seated2End.toISOString(),
        status: 'CHECKED_IN',
        elapsedMinutes: 50,
        remainingMinutes: 7,
        noteCount: 1,
        notes: [
          {
            id: 'note-patel-1',
            content: 'Requested extra scratch paper at 10:15',
            createdAt: new Date(now.getTime() - 20 * 60000).toISOString(),
            author: { firstName: 'Training', lastName: 'Supervisor' }
          }
        ],
        student: {
          id: 'train-usr-5',
          firstName: 'Aaliyah',
          lastName: 'Patel',
          studentId: '900000005',
          avatarUrl: null
        }
      }
    ]

    departures.value = []
    activeArrivalIndex.value = 0
    isMismatchNext.value = false
    lookupResult.value = null
    lastAction.value = null
  }

  // Initialize initial scenario
  buildInitialScenario()

  // Computed KPIs
  const counts = computed(() => ({
    seated: seated.value.length,
    arriving: arriving.value.length,
    departures: departures.value.length
  }))

  const activeTargetStudent = computed(() => {
    if (arriving.value.length === 0) return null
    const idx = Math.min(activeArrivalIndex.value, arriving.value.length - 1)
    return arriving.value[idx] || null
  })

  const advanceArrivalQueue = () => {
    if (arriving.value.length === 0) {
      activeArrivalIndex.value = 0
      return
    }
    activeArrivalIndex.value = (activeArrivalIndex.value + 1) % arriving.value.length
    const current = arriving.value[activeArrivalIndex.value]
    if (current) {
      toast.add({
        title: 'Queued Next Arrival',
        description: `Now targeting: ${current.studentName} (${current.assignmentTitle})`,
        color: 'info'
      })
    }
  }

  const selectArrivalIndex = (idx: number) => {
    if (idx >= 0 && idx < arriving.value.length) {
      activeArrivalIndex.value = idx
    }
  }

  const toggleMismatchNext = (val?: boolean) => {
    isMismatchNext.value = typeof val === 'boolean' ? val : !isMismatchNext.value
    if (isMismatchNext.value) {
      toast.add({
        title: 'Next Scan Set to Mismatch',
        description: 'The next card scan will simulate an unregistered student turn-away scenario.',
        color: 'warning'
      })
    }
  }

  const toggleDuty = async (newStatus: boolean) => {
    isOnDuty.value = newStatus
    toast.add({
      title: newStatus ? 'Checked On Duty' : 'Checked Off Duty',
      color: newStatus ? 'success' : 'neutral'
    })
  }

  const lookupStudent = async (rawInput: string) => {
    const studentId = parseCardSwipe(rawInput)
    if (!studentId) {
      lookupError.value = 'Please enter or swipe a valid Student ID'
      lookupResult.value = null
      return null
    }

    lookupLoading.value = true
    lookupError.value = null
    lookupResult.value = null

    try {
      // 1. If mismatch toggle is active, simulate turn-away scenario
      if (isMismatchNext.value) {
        isMismatchNext.value = false // Auto-reset after scan
        const result = {
          found: false,
          student: {
            id: 'unregistered-student',
            firstName: 'Unregistered',
            lastName: 'Student',
            studentId,
            avatarUrl: null
          },
          reservation: null,
          decision: 'NO_ACTIVE_RESERVATION',
          message: `No scheduled exam reservations found for ID (${studentId}). Advise student to verify exam schedule or contact instructor.`
        }
        lookupResult.value = result
        return result
      }

      // 2. Check if student is already seated (e.g. if swipe ID matches or user scans seated student)
      const seatedMatch = seated.value.find((s) => s.studentId === studentId)
      if (seatedMatch) {
        const result = {
          found: true,
          student: seatedMatch.student,
          reservation: seatedMatch,
          decision: 'READY_FOR_CHECKOUT',
          message: 'Student is currently seated and ready for checkout.'
        }
        lookupResult.value = result
        return result
      }

      // 3. Otherwise, map to the active scheduled arriving student
      const target = activeTargetStudent.value
      if (!target) {
        const result = {
          found: false,
          student: null,
          reservation: null,
          decision: 'NO_ACTIVE_RESERVATION',
          message: 'All scheduled arrivals have been checked in or no active reservations exist.'
        }
        lookupResult.value = result
        return result
      }

      const now = new Date()
      const nowMs = now.getTime()
      const startMs = new Date(target.startTime).getTime()
      const leadMinutes = facility.value.checkInLeadMinutes
      const graceMinutes = facility.value.checkInGraceMinutes
      const earliestAllowedMs = startMs - leadMinutes * 60000
      const latestAllowedMs = startMs + graceMinutes * 60000

      // Allocate next free seat number (seats 1-48 not in seated)
      const occupiedSeatNums = new Set(seated.value.map((s) => s.seatNumber))
      let allocatedSeat = 1
      while (occupiedSeatNums.has(allocatedSeat) && allocatedSeat <= 48) {
        allocatedSeat++
      }

      const targetWithAllocatedSeat = {
        ...target,
        seatNumber: allocatedSeat
      }

      if (nowMs < earliestAllowedMs) {
        const minutesEarly = Math.ceil((earliestAllowedMs - nowMs) / 60000)
        const result = {
          found: true,
          student: target.student,
          reservation: targetWithAllocatedSeat,
          decision: 'EARLY',
          leadMinutes,
          graceMinutes,
          message: `Too early to check in. Check-in opens in ${minutesEarly} minute(s) before start time to prevent workstation collision.`
        }
        lookupResult.value = result
        return result
      }

      if (nowMs > latestAllowedMs) {
        const minutesLate = Math.floor((nowMs - startMs) / 60000)
        const result = {
          found: true,
          student: target.student,
          reservation: targetWithAllocatedSeat,
          decision: 'LATE',
          leadMinutes,
          graceMinutes,
          message: `Reservation is ${minutesLate} minutes late (grace period: ${graceMinutes} mins). Proctor override required to check in.`
        }
        lookupResult.value = result
        return result
      }

      const result = {
        found: true,
        student: target.student,
        reservation: targetWithAllocatedSeat,
        decision: 'READY_FOR_CHECKIN',
        leadMinutes,
        graceMinutes,
        message: `Verified for ${target.assignmentTitle}. Direct to Workstation Seat #${allocatedSeat}.`
      }
      lookupResult.value = result
      return result
    } finally {
      lookupLoading.value = false
    }
  }

  const confirmCheckIn = async (reservationId: string) => {
    lookupLoading.value = true
    try {
      const arrivingIdx = arriving.value.findIndex((r) => r.id === reservationId)
      if (arrivingIdx === -1) {
        throw new Error('Reservation not found in arriving queue')
      }

      const target = arriving.value[arrivingIdx]
      // Allocate seat
      const occupiedSeatNums = new Set(seated.value.map((s) => s.seatNumber))
      let allocatedSeat = 1
      while (occupiedSeatNums.has(allocatedSeat) && allocatedSeat <= 48) {
        allocatedSeat++
      }

      const checkedInReservation: FictionalReservation = {
        ...target,
        seatNumber: allocatedSeat,
        status: 'CHECKED_IN',
        elapsedMinutes: 0,
        remainingMinutes: 60,
        noteCount: 0,
        notes: []
      }

      // Remove from arriving, add to seated
      arriving.value.splice(arrivingIdx, 1)
      seated.value.push(checkedInReservation)

      // Adjust active arrival index
      if (activeArrivalIndex.value >= arriving.value.length) {
        activeArrivalIndex.value = Math.max(0, arriving.value.length - 1)
      }

      lastAction.value = {
        message: `Checked in ${target.studentName} to Seat #${allocatedSeat}. RETAIN student ID while testing.`,
        type: 'checkin',
        time: new Date()
      }

      toast.add({
        title: `Checked In: ${target.studentName}`,
        description: `Direct to Workstation Seat #${allocatedSeat}. RETAIN student ID.`,
        color: 'success'
      })

      lookupResult.value = null
      return checkedInReservation
    } finally {
      lookupLoading.value = false
    }
  }

  const confirmCheckOut = async (reservationId: string) => {
    lookupLoading.value = true
    try {
      const seatedIdx = seated.value.findIndex((r) => r.id === reservationId)
      if (seatedIdx === -1) {
        throw new Error('Student not found in seated roster')
      }

      const target = seated.value[seatedIdx]
      const departedReservation: FictionalReservation = {
        ...target,
        status: 'CHECKED_OUT'
      }

      // Remove from seated, add to departures
      seated.value.splice(seatedIdx, 1)
      departures.value.unshift(departedReservation)

      lastAction.value = {
        message: `Checked out ${target.studentName}. RETURN student ID to student.`,
        type: 'checkout',
        time: new Date()
      }

      toast.add({
        title: `Checked Out: ${target.studentName}`,
        description: 'Exam session completed. RETURN student ID to student.',
        color: 'info'
      })

      lookupResult.value = null
      return departedReservation
    } finally {
      lookupLoading.value = false
    }
  }

  const clearLookup = () => {
    lookupResult.value = null
    lookupError.value = null
  }

  const openNoteModal = (target?: {
    reservationId?: string
    seatNumber?: number
    studentName?: string
    assignmentTitle?: string
    notes?: any[]
  }) => {
    selectedNoteTarget.value = target || null
    isNoteModalOpen.value = true
  }

  const closeNoteModal = () => {
    isNoteModalOpen.value = false
    selectedNoteTarget.value = null
  }

  const addNote = async (payload: {
    reservationId?: string
    seatNumber?: number
    content: string
    hasPhotos?: boolean
  }) => {
    // Find target in seated or arriving
    let target = seated.value.find(
      (s) => s.id === payload.reservationId || s.seatNumber === payload.seatNumber
    )
    if (!target && payload.reservationId) {
      target = arriving.value.find((r) => r.id === payload.reservationId)
    }

    const noteObj = {
      id: `note-${Date.now()}`,
      content: payload.content,
      createdAt: new Date().toISOString(),
      author: { firstName: 'Training', lastName: 'Proctor' }
    }

    if (target) {
      target.notes = target.notes || []
      target.notes.push(noteObj)
      target.noteCount = target.notes.length
    }

    toast.add({
      title: 'Incident Note Logged',
      description: `Note saved for Seat #${target?.seatNumber || payload.seatNumber || '—'} (${target?.studentName || 'Student'}).`,
      color: 'warning'
    })

    closeNoteModal()
    return noteObj
  }

  const fetchNotes = async (reservationId: string) => {
    const target =
      seated.value.find((s) => s.id === reservationId) ||
      arriving.value.find((r) => r.id === reservationId)
    return target?.notes || []
  }

  const resetScenario = () => {
    buildInitialScenario()
    toast.add({
      title: 'Training Scenario Reset',
      description: 'Fictional training scenario has been restored to its initial state.',
      color: 'info'
    })
  }

  return {
    isOnDuty,
    toggleDuty,
    facility,
    counts,
    seated,
    arriving,
    departures,
    feedStatus,
    refreshFeed,
    lookupResult,
    lookupLoading,
    lookupError,
    lastAction,
    lookupStudent,
    confirmCheckIn,
    confirmCheckOut,
    clearLookup,
    isNoteModalOpen,
    selectedNoteTarget,
    openNoteModal,
    closeNoteModal,
    addNote,
    fetchNotes,
    // Training Specific Controls
    isMismatchNext,
    toggleMismatchNext,
    activeArrivalIndex,
    activeTargetStudent,
    advanceArrivalQueue,
    selectArrivalIndex,
    resetScenario
  }
}
