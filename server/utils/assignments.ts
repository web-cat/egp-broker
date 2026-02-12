import prisma from '@@/lib/prisma'

/**
 * Synchronizes the eligibility of an assignment for various pass types based on pattern matching.
 *
 * This function:
 * 1. Fetches the assignment and all pass types for its course.
 * 2. Fetches all existing eligibility records for the assignment.
 * 3. Iterates through each pass type:
 *    - If the pass type uses pattern matching and the assignment title matches the pattern:
 *      - Creates a new eligibility record with `isAutomatic: true` if one doesn't exist.
 *      - Does NOTHING if a record already exists (to preserve manual overrides or existing automatic links).
 *    - If the pass type does NOT match:
 *      - Deletes the eligibility record ONLY if it was created automatically (`isAutomatic: true`).
 */
export async function syncAssignmentEligibility(assignmentId: string) {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, title: true, courseId: true }
    })

    if (!assignment || !assignment.title) return

    // Fetch all pass types for the course
    const passTypes = await prisma.passType.findMany({
        where: { courseId: assignment.courseId }
    })

    // Fetch all existing eligibility records for this assignment
    const existingEligibilities = await prisma.passEligibility.findMany({
        where: { assignmentId },
        select: { id: true, passTypeId: true, isAutomatic: true }
    })

    const eligibilityMap = new Map(existingEligibilities.map((e) => [e.passTypeId, e]))

    const operations = []

    for (const pt of passTypes) {
        let matches = false

        if (pt.titlePattern) {
            // Create regex from pattern (e.g., "Lab %" -> "^Lab .*$")
            // Replaces % and * with .* for wildcard matching
            // Escapes other special regex characters to prevent injection
            const patternString = pt.titlePattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
                .replace(/[%*]/g, '.*')                 // Convert wildcards

            try {
                const regex = new RegExp(`^${patternString}$`, 'i')
                matches = regex.test(assignment.title)
            } catch (e) {
                console.error(`Invalid regex for PassType ${pt.id}: ${patternString}`, e)
                matches = false
            }
        }

        const existing = eligibilityMap.get(pt.id)

        if (matches) {
            if (!existing) {
                // Create new automatic eligibility
                operations.push(
                    prisma.passEligibility.create({
                        data: {
                            passTypeId: pt.id,
                            assignmentId: assignment.id,
                            isAutomatic: true
                        }
                    })
                )
            }
            // If matches and existing, do NOT update. Preserve valid existing link.
        } else {
            if (existing && existing.isAutomatic) {
                // Remove automatic eligibility that no longer matches
                operations.push(
                    prisma.passEligibility.delete({
                        where: { id: existing.id }
                    })
                )
            }
            // If not matching and existing is manual (isAutomatic: false), preserve it.
        }
    }

    if (operations.length > 0) {
        await prisma.$transaction(operations)
    }
}

/**
 * Synchronizes a specific pass type with all assignments in its course.
 * Used when a pass type is created or updated.
 */
export async function syncPassTypeEligibility(passTypeId: string) {
    const passType = await prisma.passType.findUnique({
        where: { id: passTypeId },
        include: { course: { include: { assignments: true } } }
    })

    if (!passType) return

    const assignments = passType.course.assignments
    const operations: any[] = []

    // If no pattern, we should remove ALL automatic eligibilities for this pass type
    // because it no longer targets specific assignments automatically.
    // Manual eligibilities should be preserved.
    if (!passType.titlePattern) {
        // Find automatic eligibilities to delete
        const autoEligibilities = await prisma.passEligibility.findMany({
            where: {
                passTypeId: passType.id,
                isAutomatic: true
            },
            select: { id: true }
        })

        if (autoEligibilities.length > 0) {
            await prisma.passEligibility.deleteMany({
                where: {
                    id: { in: autoEligibilities.map(e => e.id) }
                }
            })
        }
        return
    }

    // If there is a pattern, we need to check against ALL assignments
    const patternString = passType.titlePattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[%*]/g, '.*')

    let regex: RegExp
    try {
        regex = new RegExp(`^${patternString}$`, 'i')
    } catch (e) {
        console.error(`Invalid regex during syncPassTypeEligibility: ${patternString}`, e)
        return
    }

    // Get existing eligibilities for this pass type to know what to add/remove
    const existingEligibilities = await prisma.passEligibility.findMany({
        where: { passTypeId: passType.id },
        select: { id: true, assignmentId: true, isAutomatic: true }
    })

    // Map assignmentId -> eligibility
    const eligibilityMap = new Map(existingEligibilities.map(e => [e.assignmentId, e]))

    for (const assignment of assignments) {
        if (!assignment.title) continue

        const matches = regex.test(assignment.title)
        const existing = eligibilityMap.get(assignment.id)

        if (matches) {
            if (!existing) {
                // Match found, no eligibility -> Create automatic
                operations.push(
                    prisma.passEligibility.create({
                        data: {
                            passTypeId: passType.id,
                            assignmentId: assignment.id,
                            isAutomatic: true
                        }
                    })
                )
            }
        } else {
            if (existing && existing.isAutomatic) {
                // No match, but exists automatically -> Delete
                operations.push(
                    prisma.passEligibility.delete({
                        where: { id: existing.id }
                    })
                )
            }
        }
    }

    if (operations.length > 0) {
        await prisma.$transaction(operations)
    }
}
