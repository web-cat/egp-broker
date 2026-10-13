import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { lookupStudentForProctor } from '@@/server/utils/cbtf'
import { proctorLookupQuerySchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'
import type { ProctorLookupResultDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<ProctorLookupResultDto>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const { studentId } = await getValidatedQuery(event, proctorLookupQuerySchema.parse)

  const result = await lookupStudentForProctor(prisma, studentId)

  return {
    statusCode: 200,
    data: result
  }
})
