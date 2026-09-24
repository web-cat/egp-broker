import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { cbtfAdminNotesQuerySchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfAdminReservationNoteDto } from '@@/shared/models/cbtf'
import type { Prisma } from '@prisma/client'

function parseDateFilter(dateStr: string, isEnd = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T${isEnd ? '23:59:59.999' : '00:00:00.000'}Z`)
  }
  return new Date(dateStr)
}

export default defineEventHandler(
  async (event): Promise<ApiResponse<CbtfAdminReservationNoteDto[]>> => {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    if (session.user.globalRole !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const rawQuery = getQuery(event)
    const parsed = cbtfAdminNotesQuerySchema.safeParse(rawQuery)
    const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 }

    const where: Prisma.CbtfReservationNoteWhereInput = {}

    // 1. Date range filter on createdAt
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: parseDateFilter(query.from, false) } : {}),
        ...(query.to ? { lte: parseDateFilter(query.to, true) } : {})
      }
    }

    // 2. Reservation filters (student, assignment, course)
    const reservationWhere: Prisma.CbtfReservationWhereInput = {}

    const studentTerm = query.student?.trim() || query.search?.trim()
    if (studentTerm) {
      const words = studentTerm.split(/\s+/).filter(Boolean)
      if (words.length > 1) {
        reservationWhere.user = {
          AND: words.map((w) => ({
            OR: [
              { firstName: { contains: w, mode: 'insensitive' } },
              { lastName: { contains: w, mode: 'insensitive' } },
              { email: { contains: w, mode: 'insensitive' } },
              { studentId: { contains: w, mode: 'insensitive' } }
            ]
          }))
        }
      } else {
        reservationWhere.user = {
          OR: [
            { firstName: { contains: studentTerm, mode: 'insensitive' } },
            { lastName: { contains: studentTerm, mode: 'insensitive' } },
            { email: { contains: studentTerm, mode: 'insensitive' } },
            { studentId: { contains: studentTerm, mode: 'insensitive' } }
          ]
        }
      }
    }

    if (query.assignment?.trim() || query.course?.trim()) {
      const assignmentWhere: Prisma.AssignmentWhereInput = {}
      if (query.assignment?.trim()) {
        assignmentWhere.title = { contains: query.assignment.trim(), mode: 'insensitive' }
      }
      if (query.course?.trim()) {
        const courseTerm = query.course.trim()
        assignmentWhere.course = {
          OR: [
            { label: { contains: courseTerm, mode: 'insensitive' } },
            { title: { contains: courseTerm, mode: 'insensitive' } }
          ]
        }
      }
      reservationWhere.assignment = assignmentWhere
    }

    if (Object.keys(reservationWhere).length > 0) {
      where.reservation = reservationWhere
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const take = pageSize

    const [total, notes] = await Promise.all([
      prisma.cbtfReservationNote.count({ where }),
      prisma.cbtfReservationNote.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          reservation: {
            select: {
              id: true,
              seatNumber: true,
              startTime: true,
              endTime: true,
              status: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  studentId: true
                }
              },
              assignment: {
                select: {
                  id: true,
                  title: true,
                  course: {
                    select: {
                      id: true,
                      label: true,
                      title: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      })
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const dtos: CbtfAdminReservationNoteDto[] = notes.map((n) => ({
      id: n.id,
      reservationId: n.reservationId,
      content: n.content,
      hasPhotos: n.hasPhotos,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      author: {
        id: n.author.id,
        name: `${n.author.firstName} ${n.author.lastName}`.trim(),
        email: n.author.email
      },
      reservation: {
        id: n.reservation.id,
        seatNumber: n.reservation.seatNumber,
        startTime: n.reservation.startTime.toISOString(),
        endTime: n.reservation.endTime.toISOString(),
        status: n.reservation.status,
        student: {
          id: n.reservation.user.id,
          name: `${n.reservation.user.firstName} ${n.reservation.user.lastName}`.trim(),
          email: n.reservation.user.email,
          studentId: n.reservation.user.studentId
        },
        assignment: {
          id: n.reservation.assignment.id,
          title: n.reservation.assignment.title ?? ''
        },
        course: {
          id: n.reservation.assignment.course.id,
          label: n.reservation.assignment.course.label ?? '',
          title: n.reservation.assignment.course.title ?? ''
        }
      }
    }))

    return {
      statusCode: 200,
      data: dtos,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    }
  }
)
