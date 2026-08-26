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
  if (latestRedemption?.dueDate) {
    const prevDueDate = new Date(latestRedemption.dueDate)
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
  if (!passType.extensionOnly) {
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

  // --- Extension-only pass ---
  // Current effective deadline (latest redemption's dueDate, or original assignment dueDate)
  const currentDueDate = latestRedemption?.dueDate
    ? new Date(latestRedemption.dueDate)
    : origDueDate

  // If already at or beyond maximum allowed date, cannot extend further
  if (maxAllowedDate && currentDueDate.getTime() >= maxAllowedDate.getTime()) {
    return {
      isEligible: false,
      reason: 'Assignment has already reached the maximum days limit.',
      cost: 0,
      newDueDate: null,
      newAcceptUntil: null,
      isClipped: false
    }
  }

  // Calculate required pass cost (K)
  let cost = 1
  if (now.getTime() > currentDueDate.getTime()) {
    const elapsedPastCurrent = now.getTime() - currentDueDate.getTime()
    cost = Math.floor(elapsedPastCurrent / durationMs) + 1
  }

  // Calculate new due date
  const rawDueDate = new Date(currentDueDate.getTime() + cost * durationMs)
  let newDueDate = rawDueDate
  let isClipped = false

  if (maxAllowedDate && rawDueDate.getTime() > maxAllowedDate.getTime()) {
    newDueDate = maxAllowedDate
    isClipped = true
  }

  // If even after calculating, the new due date is not in the future relative to now, cannot redeem
  if (newDueDate.getTime() < now.getTime()) {
    return {
      isEligible: false,
      reason: 'Extension cannot move deadline past the current time within allowed limits.',
      cost,
      newDueDate: null,
      newAcceptUntil: null,
      isClipped
    }
  }

  // Calculate new acceptUntil
  const currentAcceptUntil = latestRedemption?.acceptUntil
    ? new Date(latestRedemption.acceptUntil)
    : assignment.acceptUntil
      ? new Date(assignment.acceptUntil)
      : currentDueDate

  let newAcceptUntil = newDueDate
  if (currentAcceptUntil.getTime() !== currentDueDate.getTime()) {
    const offset = currentAcceptUntil.getTime() - currentDueDate.getTime()
    const rawAcceptUntil = new Date(newDueDate.getTime() + offset)
    newAcceptUntil =
      maxAllowedDate && rawAcceptUntil.getTime() > maxAllowedDate.getTime()
        ? maxAllowedDate
        : rawAcceptUntil
  }

  return {
    isEligible: true,
    cost,
    newDueDate,
    newAcceptUntil,
    isClipped
  }
}
