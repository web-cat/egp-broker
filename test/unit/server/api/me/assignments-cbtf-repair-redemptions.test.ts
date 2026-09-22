import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/cbtf-repair-redemptions.post'
import * as redemptionsModule from '@@/server/utils/redemptions'

vi.mock('@@/server/utils/redemptions', () => ({
  repairAssignmentCbtfPassRedemptions: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts,
    getRouterParam: vi.fn().mockReturnValue('asg-1')
  }
})

describe('POST /api/me/assignments/:id/cbtf-repair-redemptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 401 when user is not authenticated', async () => {
    vi.stubGlobal('getUserSession', () => Promise.resolve({ user: null }))

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('throws 403 when user is not a global administrator', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'user-1', globalRole: 'USER' } })
    )

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden: Global administrator privileges required'
    })
  })

  it('throws 400 when assignment id param is missing', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValueOnce(undefined)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Assignment ID is required'
    })
  })

  it('successfully invokes repairAssignmentCbtfPassRedemptions for administrator', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )

    const mockRepairResult = {
      totalChecked: 3,
      totalRepaired: 2,
      alreadyCorrect: 1,
      errors: 0,
      details: [
        {
          redemptionId: 'red-1',
          studentName: 'Student One',
          status: 'repaired' as const
        }
      ]
    }
    vi.mocked(redemptionsModule.repairAssignmentCbtfPassRedemptions).mockResolvedValue(
      mockRepairResult
    )

    const res = await handler({} as any)
    expect(res).toEqual({
      statusCode: 200,
      data: mockRepairResult
    })
    expect(redemptionsModule.repairAssignmentCbtfPassRedemptions).toHaveBeenCalledWith('asg-1')
  })
})
