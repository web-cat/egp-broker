import prisma from '@@/lib/prisma'
import type { CourseRow } from '@@/shared/models/course'

/**
 * Validates and retrieves all courses, formatted as strict CourseRows.
 */
export async function getAllCourses(): Promise<CourseRow[]> {
    const courses = await prisma.course.findMany({
        include: {
            _count: {
                select: {
                    enrollments: true,
                    assignments: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return courses.map((c) => ({
        id: c.id,
        ltiContextId: c.ltiContextId ?? '',
        label: c.label,
        title: c.title,
        enrollmentCount: c._count.enrollments,
        assignmentCount: c._count.assignments,
        createdAt: c.createdAt.toISOString()
    }))
}

/**
 * Retrieves a single course by ID, formatted as strict CourseRow.
 */
export async function getCourse(id: string): Promise<CourseRow | null> {
    const course = await prisma.course.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    enrollments: true,
                    assignments: true
                }
            }
        }
    })

    if (!course) return null

    return {
        id: course.id,
        ltiContextId: course.ltiContextId ?? '',
        label: course.label,
        title: course.title,
        enrollmentCount: course._count.enrollments,
        assignmentCount: course._count.assignments,
        createdAt: course.createdAt.toISOString()
    }
}
