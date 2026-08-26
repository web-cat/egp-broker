import { describe, it, expect } from 'vitest'
import { calculatePassExtension } from '@@/shared/utils/extension'

describe('calculatePassExtension', () => {
  const baseAssignment = {
    dueDate: '2026-03-10T23:59:00.000Z',
    acceptUntil: '2026-03-10T23:59:00.000Z'
  }

  describe('extensionOnly: true', () => {
    const passType24h = {
      extensionOnly: true,
      hoursPerPass: 24,
      minDaysPastDue: null,
      maxDaysPastDue: null
    }

    it('Example 1: on-time / early redemption costs 1 pass and extends deadline by hoursPerPass', () => {
      // Due 3/10 23:59, redeemed 3/11 08:00 (approx 8 hours past due, but <= 24h)
      const now = new Date('2026-03-11T08:00:00.000Z')
      const result = calculatePassExtension({
        assignment: baseAssignment,
        passType: passType24h,
        latestRedemption: null,
        now
      })

      expect(result.isEligible).toBe(true)
      expect(result.cost).toBe(1)
      expect(result.newDueDate?.toISOString()).toBe('2026-03-11T23:59:00.000Z')
      expect(result.newAcceptUntil?.toISOString()).toBe('2026-03-11T23:59:00.000Z')
      expect(result.isClipped).toBe(false)
    })

    it('Example 2: contiguous stacking from previous redemption', () => {
      // First redemption moved deadline to 3/11 23:59
      const latestRedemption = {
        dueDate: '2026-03-11T23:59:00.000Z',
        acceptUntil: '2026-03-11T23:59:00.000Z'
      }
      const now = new Date('2026-03-12T08:00:00.000Z')
      const result = calculatePassExtension({
        assignment: baseAssignment,
        passType: passType24h,
        latestRedemption,
        now
      })

      expect(result.isEligible).toBe(true)
      expect(result.cost).toBe(1)
      expect(result.newDueDate?.toISOString()).toBe('2026-03-12T23:59:00.000Z')
      expect(result.newAcceptUntil?.toISOString()).toBe('2026-03-12T23:59:00.000Z')
    })

    it('Example 3: past-due redemption requires multi-pass catch-up (32h past deadline with 24h pass costs 2 passes)', () => {
      // Originally due 4/5 23:59, now 4/7 08:00 (approx 32 hours past deadline)
      const assignment = {
        dueDate: '2026-04-05T23:59:00.000Z',
        acceptUntil: '2026-04-05T23:59:00.000Z'
      }
      const now = new Date('2026-04-07T08:00:00.000Z')
      const result = calculatePassExtension({
        assignment,
        passType: passType24h,
        latestRedemption: null,
        now
      })

      expect(result.isEligible).toBe(true)
      expect(result.cost).toBe(2)
      // 4/5 23:59 + 48h = 4/7 23:59
      expect(result.newDueDate?.toISOString()).toBe('2026-04-07T23:59:00.000Z')
      expect(result.newAcceptUntil?.toISOString()).toBe('2026-04-07T23:59:00.000Z')
    })

    it('Example 4: clipping by maxDaysPastDue when redeeming second pass', () => {
      // Due 5/20 23:59, passType 48h, maxDays: 4
      const assignment = {
        dueDate: '2026-05-20T23:59:00.000Z',
        acceptUntil: '2026-05-20T23:59:00.000Z'
      }
      const passType48h = {
        extensionOnly: true,
        hoursPerPass: 48,
        minDaysPastDue: 0,
        maxDaysPastDue: 4
      }

      // First pass on 5/21 10:00 -> extends to 5/22 23:59
      const firstResult = calculatePassExtension({
        assignment,
        passType: passType48h,
        latestRedemption: null,
        now: new Date('2026-05-21T10:00:00.000Z')
      })
      expect(firstResult.cost).toBe(1)
      expect(firstResult.newDueDate?.toISOString()).toBe('2026-05-22T23:59:00.000Z')

      // Second pass on 5/23 09:15 with maxDays = 4 -> extends to 5/24 23:59 (exactly 4 days)
      const secondResult = calculatePassExtension({
        assignment,
        passType: passType48h,
        latestRedemption: {
          dueDate: '2026-05-22T23:59:00.000Z',
          acceptUntil: '2026-05-22T23:59:00.000Z'
        },
        now: new Date('2026-05-23T09:15:00.000Z')
      })
      expect(secondResult.cost).toBe(1)
      expect(secondResult.newDueDate?.toISOString()).toBe('2026-05-24T23:59:00.000Z')
      expect(secondResult.isClipped).toBe(false)
    })

    it('Example 5: clipping by maxDaysPastDue = 3 on second redemption', () => {
      // Due 5/20 23:59, passType 48h, maxDays: 3
      const assignment = {
        dueDate: '2026-05-20T23:59:00.000Z',
        acceptUntil: '2026-05-20T23:59:00.000Z'
      }
      const passType48hMax3 = {
        extensionOnly: true,
        hoursPerPass: 48,
        minDaysPastDue: 0,
        maxDaysPastDue: 3
      }

      // Second pass on 5/23 09:15 -> clipped to 5/23 23:59 (3 days from 5/20 23:59)
      const result = calculatePassExtension({
        assignment,
        passType: passType48hMax3,
        latestRedemption: {
          dueDate: '2026-05-22T23:59:00.000Z',
          acceptUntil: '2026-05-22T23:59:00.000Z'
        },
        now: new Date('2026-05-23T09:15:00.000Z')
      })
      expect(result.cost).toBe(1)
      expect(result.newDueDate?.toISOString()).toBe('2026-05-23T23:59:00.000Z')
      expect(result.isClipped).toBe(true)
    })

    it('Example 6: multi-pass redemption with maxDaysPastDue clipping (waiting until 5/23 09:15 without earlier pass)', () => {
      // Due 5/20 23:59, passType 48h, maxDays: 3
      // At 5/23 09:15 (57h past due), 2 passes required, extends by 72h (clipped from 96h to 5/23 23:59)
      const assignment = {
        dueDate: '2026-05-20T23:59:00.000Z',
        acceptUntil: '2026-05-20T23:59:00.000Z'
      }
      const passType48hMax3 = {
        extensionOnly: true,
        hoursPerPass: 48,
        minDaysPastDue: 0,
        maxDaysPastDue: 3
      }

      const result = calculatePassExtension({
        assignment,
        passType: passType48hMax3,
        latestRedemption: null,
        now: new Date('2026-05-23T09:15:00.000Z')
      })
      expect(result.cost).toBe(2)
      expect(result.newDueDate?.toISOString()).toBe('2026-05-23T23:59:00.000Z')
      expect(result.isClipped).toBe(true)
    })

    it('Ineligibility: rejected if now is strictly past maxDaysPastDue cutoff', () => {
      const assignment = {
        dueDate: '2026-05-20T23:59:00.000Z',
        acceptUntil: '2026-05-20T23:59:00.000Z'
      }
      const passType = {
        extensionOnly: true,
        hoursPerPass: 24,
        minDaysPastDue: 0,
        maxDaysPastDue: 2 // Max deadline is 5/22 23:59
      }
      const now = new Date('2026-05-23T00:01:00.000Z') // Past max days

      const result = calculatePassExtension({
        assignment,
        passType,
        latestRedemption: null,
        now
      })
      expect(result.isEligible).toBe(false)
      expect(result.reason).toContain('maximum days limit')
    })

    it('Ineligibility: rejected if previous redemption due date has not yet passed', () => {
      const assignment = {
        dueDate: '2026-05-20T23:59:00.000Z',
        acceptUntil: '2026-05-20T23:59:00.000Z'
      }
      const passType = {
        extensionOnly: true,
        hoursPerPass: 24,
        minDaysPastDue: 0,
        maxDaysPastDue: 5
      }
      // Previous redemption extended due date to 5/21 23:59
      const latestRedemption = {
        dueDate: '2026-05-21T23:59:00.000Z',
        acceptUntil: '2026-05-21T23:59:00.000Z'
      }
      // Student tries to redeem again on 5/21 at 12:00 (before previous extended due date has passed)
      const now = new Date('2026-05-21T12:00:00.000Z')

      const result = calculatePassExtension({
        assignment,
        passType,
        latestRedemption,
        now
      })
      expect(result.isEligible).toBe(false)
      expect(result.reason).toContain('until the current extended deadline has passed')
    })
  })

  describe('extensionOnly: false (Standard Resubmission/Retry Pass)', () => {
    const passTypeRetry = {
      extensionOnly: false,
      hoursPerPass: 24,
      minDaysPastDue: null,
      maxDaysPastDue: null
    }

    it('opens window from now to now + hoursPerPass', () => {
      const now = new Date('2026-06-01T12:00:00.000Z')
      const result = calculatePassExtension({
        assignment: baseAssignment,
        passType: passTypeRetry,
        latestRedemption: null,
        now
      })

      expect(result.isEligible).toBe(true)
      expect(result.cost).toBe(1)
      expect(result.newAvailableFrom?.toISOString()).toBe('2026-06-01T12:00:00.000Z')
      expect(result.newDueDate?.toISOString()).toBe('2026-06-02T12:00:00.000Z')
      expect(result.newAcceptUntil?.toISOString()).toBe('2026-06-02T12:00:00.000Z')
    })
  })
})
