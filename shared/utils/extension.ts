/**
 * Pass Extension Calculation Utility
 *
 * Implements the domain logic for extension-only passes and standard resubmission passes
 * as specified in docs/requirements/extension-passes.md.
 */

export interface PassExtensionInput {
  assignment: {
    dueDate?: Date | string | null
    acceptUntil?: Date | string | null
    availableFrom?: Date | string | null
  }
  passType: {
    extensionOnly: boolean
    extendsCutoffOnly?: boolean
    hoursPerPass: number
    minDaysPastDue?: number | null
    maxDaysPastDue?: number | null
  }
  latestRedemption?: {
    dueDate?: Date | string | null
    acceptUntil?: Date | string | null
    availableFrom?: Date | string | null
  } | null
  now?: Date
}

export interface PassExtensionResult {
  isEligible: boolean
  reason?: string
  cost: number
  newDueDate: Date | null
  newAcceptUntil: Date | null
  newAvailableFrom?: Date | null
  isClipped: boolean
}

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR

/**
 * Calculates the cost, new due date, and new cutoff window when redeeming a pass.
 */
export function calculatePassExtension(input: PassExtensionInput): PassExtensionResult {
  const { assignment, passType, latestRedemption } = input
  const now = input.now ? new Date(input.now) : new Date()

  const origDueDate = assignment.dueDate ? new Date(assignment.dueDate) : now
  const hoursPerPass = passType.hoursPerPass > 0 ? passType.hoursPerPass : 24
  const durationMs = hoursPerPass * MS_PER_HOUR

  // Check minimum days past due constraint
  if (
    passType.minDaysPastDue !== null &&
    passType.minDaysPastDue !== undefined &&
    passType.minDaysPastDue > 0
  ) {
    const minAllowedDate = new Date(origDueDate.getTime() + passType.minDaysPastDue * MS_PER_DAY)
    if (now < minAllowedDate) {
      return {
        isEligible: false,
        reason: 'Redemption is not allowed before the minimum days limit.',
        cost: 0,
        newDueDate: null,
        newAcceptUntil: null,
        isClipped: false
      }
    }
  }

  // Calculate maximum allowed date boundary
  const maxAllowedDate =
    passType.maxDaysPastDue !== null && passType.maxDaysPastDue !== undefined
      ? new Date(origDueDate.getTime() + passType.maxDaysPastDue * MS_PER_DAY)
      : null

  // Check if now is already past the maximum days cutoff
  if (maxAllowedDate && now > maxAllowedDate) {
    return {
      isEligible: false,
      reason: 'Redemption is not allowed past the maximum days limit.',
      cost: 0,
      newDueDate: null,
      newAcceptUntil: null,
      isClipped: false
    }
  }

  // Check if student already redeemed a pass and the extended deadline has not passed yet
  if (passType.extensionOnly || passType.extendsCutoffOnly) {
    const prevCutoff = latestRedemption?.acceptUntil || latestRedemption?.dueDate
    if (prevCutoff) {
      const prevCutoffDate = new Date(prevCutoff)
      if (now.getTime() <= prevCutoffDate.getTime()) {
        return {
          isEligible: false,
          reason:
            'Assignment is not eligible for another pass until the current extended cutoff deadline has passed.',
          cost: 0,
          newDueDate: null,
          newAcceptUntil: null,
          isClipped: false
        }
      }
    }
  } else if (latestRedemption?.dueDate || latestRedemption?.acceptUntil) {
    const prevDueDate = new Date(latestRedemption.dueDate || latestRedemption.acceptUntil!)
    if (now.getTime() <= prevDueDate.getTime()) {
      return {
        isEligible: false,
        reason:
          'Assignment is not eligible for another pass until the current extended deadline has passed.',
        cost: 0,
        newDueDate: null,
        newAcceptUntil: null,
        isClipped: false
      }
    }
  }

  // --- Non-extension pass (Standard Resubmission/Retry) ---
  if (!passType.extensionOnly && !passType.extendsCutoffOnly) {
    const rawDueDate = new Date(now.getTime() + durationMs)
    let newDueDate = rawDueDate
    let isClipped = false

    if (maxAllowedDate && rawDueDate > maxAllowedDate) {
      newDueDate = maxAllowedDate
      isClipped = true
    }

    return {
      isEligible: true,
      cost: 1,
      newDueDate,
      newAcceptUntil: newDueDate,
      newAvailableFrom: now,
      isClipped
    }
  }

  // --- Extension-only pass (Leaves DueDate fixed/null, moves AcceptUntil) ---
  const baseAcceptUntil = assignment.acceptUntil ? new Date(assignment.acceptUntil) : origDueDate

  const currentCutoff = latestRedemption?.acceptUntil
    ? new Date(latestRedemption.acceptUntil)
    : baseAcceptUntil

  if (maxAllowedDate && currentCutoff.getTime() >= maxAllowedDate.getTime()) {
    return {
      isEligible: false,
      reason: 'Assignment has already reached the maximum days limit.',
      cost: 0,
      newDueDate: null,
      newAcceptUntil: null,
      isClipped: false
    }
  }

  let cost = 1
  if (now.getTime() > currentCutoff.getTime()) {
    const elapsedPastCurrent = now.getTime() - currentCutoff.getTime()
    cost = Math.floor(elapsedPastCurrent / durationMs) + 1
  }

  const rawAcceptUntil = new Date(currentCutoff.getTime() + cost * durationMs)
  let newAcceptUntil = rawAcceptUntil
  let isClipped = false

  if (maxAllowedDate && rawAcceptUntil.getTime() > maxAllowedDate.getTime()) {
    newAcceptUntil = maxAllowedDate
    isClipped = true
  }

  if (newAcceptUntil.getTime() < now.getTime()) {
    return {
      isEligible: false,
      reason: 'Extension cannot move deadline past the current time within allowed limits.',
      cost,
      newDueDate: null,
      newAcceptUntil: null,
      isClipped
    }
  }

  return {
    isEligible: true,
    cost,
    newDueDate: null,
    newAcceptUntil,
    isClipped
  }
}
