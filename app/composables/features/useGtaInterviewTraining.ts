import { ref, computed } from 'vue'

export interface FictionalStudent {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
}

export interface FictionalAssignment {
  id: string
  title: string
}

export interface FictionalReservation {
  id: string
  courseId: string
  assignmentId: string
  studentId: string
  gtaId: string
  startTime: string
  endTime: string
  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'MISSED' | 'CANCELLED'
  checkedInAt?: string | null
  checkedOutAt?: string | null
  notes?: string | null
  student?: FictionalStudent
  assignment?: FictionalAssignment
}

export function useGtaInterviewTraining() {
  const toast = useToast()

  const buildInitialScenario = (): FictionalReservation[] => {
    const now = new Date()

    // 1. Ready for Check-in (starts in 5 minutes, 10 min duration)
    const stdStart = new Date(now.getTime() + 5 * 60000)
    const stdEnd = new Date(now.getTime() + 15 * 60000)

    // 2. Upcoming Arrival (starts in 15 minutes)
    const nextStart = new Date(now.getTime() + 15 * 60000)
    const nextEnd = new Date(now.getTime() + 25 * 60000)

    // 3. Absent / Missed Candidate (started 15 minutes ago)
    const pastStart = new Date(now.getTime() - 15 * 60000)
    const pastEnd = new Date(now.getTime() - 5 * 60000)

    // 4. Completed earlier in shift
    const compStart = new Date(now.getTime() - 35 * 60000)
    const compEnd = new Date(now.getTime() - 25 * 60000)
    const compCheckIn = new Date(now.getTime() - 34 * 60000)
    const compCheckOut = new Date(now.getTime() - 26 * 60000)

    return [
      {
        id: 'train-res-1',
        courseId: 'train-course',
        assignmentId: 'train-asg-1',
        studentId: 'train-std-1',
        gtaId: 'train-gta-1',
        startTime: stdStart.toISOString(),
        endTime: stdEnd.toISOString(),
        status: 'SCHEDULED',
        notes: null,
        student: {
          id: 'train-std-1',
          firstName: 'Maya',
          lastName: 'Lin',
          email: 'mlin@university.edu'
        },
        assignment: {
          id: 'train-asg-1',
          title: 'Project 1: Memory Allocator'
        }
      },
      {
        id: 'train-res-2',
        courseId: 'train-course',
        assignmentId: 'train-asg-1',
        studentId: 'train-std-2',
        gtaId: 'train-gta-1',
        startTime: nextStart.toISOString(),
        endTime: nextEnd.toISOString(),
        status: 'SCHEDULED',
        notes: null,
        student: {
          id: 'train-std-2',
          firstName: 'Leo',
          lastName: 'Vance',
          email: 'lvance@university.edu'
        },
        assignment: {
          id: 'train-asg-1',
          title: 'Project 1: Memory Allocator'
        }
      },
      {
        id: 'train-res-3',
        courseId: 'train-course',
        assignmentId: 'train-asg-1',
        studentId: 'train-std-3',
        gtaId: 'train-gta-1',
        startTime: pastStart.toISOString(),
        endTime: pastEnd.toISOString(),
        status: 'SCHEDULED',
        notes: null,
        student: {
          id: 'train-std-3',
          firstName: 'Liam',
          lastName: 'Cooper',
          email: 'lcooper@university.edu'
        },
        assignment: {
          id: 'train-asg-1',
          title: 'Project 1: Memory Allocator'
        }
      },
      {
        id: 'train-res-4',
        courseId: 'train-course',
        assignmentId: 'train-asg-1',
        studentId: 'train-std-4',
        gtaId: 'train-gta-1',
        startTime: compStart.toISOString(),
        endTime: compEnd.toISOString(),
        status: 'COMPLETED',
        checkedInAt: compCheckIn.toISOString(),
        checkedOutAt: compCheckOut.toISOString(),
        notes:
          'Walkthrough complete. Strong pointer arithmetic explanation; handled edge case tests nicely.',
        student: {
          id: 'train-std-4',
          firstName: 'Priya',
          lastName: 'Sharma',
          email: 'psharma@university.edu'
        },
        assignment: {
          id: 'train-asg-1',
          title: 'Project 1: Memory Allocator'
        }
      }
    ]
  }

  const reservations = ref<FictionalReservation[]>(buildInitialScenario())
  const feedStatus = ref('success')
  const isUpdating = ref(false)

  const activeInterview = computed<FictionalReservation | null>(
    () => reservations.value.find((r) => r.status === 'CHECKED_IN') || null
  )

  const expectedArrivals = computed<FictionalReservation[]>(() =>
    reservations.value
      .filter((r) => r.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  )

  const completedList = computed<FictionalReservation[]>(() =>
    reservations.value
      .filter(
        (r) => r.status === 'COMPLETED' || r.status === 'CHECKED_OUT' || r.status === 'MISSED'
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  )

  const refreshFeed = async () => {
    // In-memory noop
  }

  const checkIn = async (reservationId: string): Promise<FictionalReservation> => {
    isUpdating.value = true
    try {
      const idx = reservations.value.findIndex((r) => r.id === reservationId)
      if (idx === -1) throw new Error('Reservation not found')

      const updated: FictionalReservation = {
        ...reservations.value[idx],
        status: 'CHECKED_IN',
        checkedInAt: new Date().toISOString()
      }
      reservations.value[idx] = updated

      toast.add({
        title: 'Student Checked In (Training)',
        description: `${updated.student?.firstName || 'Student'} is now in their interview session.`,
        color: 'success'
      })
      return updated
    } finally {
      isUpdating.value = false
    }
  }

  const saveNotes = async (reservationId: string, notes: string): Promise<FictionalReservation> => {
    isUpdating.value = true
    try {
      const idx = reservations.value.findIndex((r) => r.id === reservationId)
      if (idx === -1) throw new Error('Reservation not found')

      const updated: FictionalReservation = {
        ...reservations.value[idx],
        notes
      }
      reservations.value[idx] = updated

      toast.add({
        title: 'Notes Saved (Training)',
        description: 'Interview observation notes updated in sandbox.',
        color: 'info'
      })
      return updated
    } finally {
      isUpdating.value = false
    }
  }

  const checkOut = async (reservationId: string, notes?: string): Promise<FictionalReservation> => {
    isUpdating.value = true
    try {
      const idx = reservations.value.findIndex((r) => r.id === reservationId)
      if (idx === -1) throw new Error('Reservation not found')

      const updated: FictionalReservation = {
        ...reservations.value[idx],
        status: 'COMPLETED',
        checkedOutAt: new Date().toISOString(),
        ...(notes !== undefined ? { notes } : {})
      }
      reservations.value[idx] = updated

      toast.add({
        title: 'Interview Completed (Training)',
        description: 'Interview session checked out and marked complete in sandbox.',
        color: 'success'
      })
      return updated
    } finally {
      isUpdating.value = false
    }
  }

  const markNoShow = async (reservationId: string): Promise<FictionalReservation> => {
    isUpdating.value = true
    try {
      const idx = reservations.value.findIndex((r) => r.id === reservationId)
      if (idx === -1) throw new Error('Reservation not found')

      const updated: FictionalReservation = {
        ...reservations.value[idx],
        status: 'MISSED'
      }
      reservations.value[idx] = updated

      toast.add({
        title: 'Marked as No-Show (Training)',
        description: 'Student marked as absent/no-show in sandbox.',
        color: 'warning'
      })
      return updated
    } finally {
      isUpdating.value = false
    }
  }

  const resetScenario = () => {
    reservations.value = buildInitialScenario()
    toast.add({
      title: 'Scenario Reset',
      description: 'Training sandbox scenario reset to initial state.',
      color: 'info'
    })
  }

  return {
    reservations,
    activeInterview,
    expectedArrivals,
    completedList,
    feedStatus,
    isUpdating,
    refreshFeed,
    checkIn,
    checkOut,
    saveNotes,
    markNoShow,
    resetScenario
  }
}
