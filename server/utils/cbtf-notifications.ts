import type { H3Event } from 'h3'
import prisma from '@@/server/utils/db'
import { getEmailTransporter } from '@@/server/utils/email-transporter.helpers'

/**
 * Send an automated email notification summarizing proctor incident notes
 * when a student checks out of their exam session.
 */
export async function sendCbtfIncidentNotification(
  reservationId: string,
  _event?: H3Event
): Promise<boolean> {
  try {
    const reservation = await prisma.cbtfReservation.findUnique({
      where: { id: reservationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            email: true
          }
        },
        assignment: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: {
              select: {
                id: true,
                title: true,
                label: true
              }
            }
          }
        },
        facility: {
          select: {
            name: true
          }
        },
        notes: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!reservation || !reservation.notes || reservation.notes.length === 0) {
      return false
    }

    const courseId = reservation.assignment.courseId
    const studentName = `${reservation.user.firstName} ${reservation.user.lastName}`.trim()
    const studentIdStr = reservation.user.studentId || 'N/A'
    const assignmentTitle = reservation.assignment.title
    const courseTitle =
      reservation.assignment.course?.title || reservation.assignment.course?.label || 'Course'
    const seatNumber = reservation.seatNumber
    const checkInTime = reservation.checkedInAt
      ? new Date(reservation.checkedInAt).toLocaleString()
      : 'N/A'
    const checkOutTime = reservation.checkedOutAt
      ? new Date(reservation.checkedOutAt).toLocaleString()
      : new Date().toLocaleString()

    // 1. Resolve recipients: Course instructors and CBTF managers (Admins)
    const instructorEnrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        courseRole: { in: ['TEACHER', 'ADMIN'] }
      },
      select: {
        user: { select: { email: true } }
      }
    })

    const managers = await prisma.user.findMany({
      where: {
        globalRole: 'ADMIN'
      },
      select: { email: true }
    })

    const recipientSet = new Set<string>()
    for (const enr of instructorEnrollments) {
      if (enr.user?.email) recipientSet.add(enr.user.email)
    }
    for (const mgr of managers) {
      if (mgr.email) recipientSet.add(mgr.email)
    }

    const recipients = Array.from(recipientSet)
    if (recipients.length === 0) {
      console.warn(
        `[CBTF Notification] No instructor or manager emails found for course ${courseId}`
      )
      return false
    }

    // 2. Check if picture(s) were indicated on any note
    const anyPhotos = reservation.notes.some((n) => n.hasPhotos)
    const proctorAuthors = Array.from(
      new Set(
        reservation.notes
          .filter((n) => n.hasPhotos)
          .map((n) => `${n.author.firstName} ${n.author.lastName} (${n.author.email})`)
      )
    )

    // 3. Format Subject & Content
    const subject = `[CBTF Incident Report] ${studentName} - ${assignmentTitle} (${courseTitle})`

    const photoBannerHtml = anyPhotos
      ? `<div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin: 16px 0; color: #991b1b;">
          <strong>⚠️ PHOTO EVIDENCE TAKEN:</strong><br/>
          The proctor indicated that picture(s) were captured on their device during this exam session.
          Please contact the observing proctor(s) to obtain the photo evidence:
          <ul style="margin: 6px 0 0 0; padding-left: 20px;">
            ${proctorAuthors.map((author) => `<li>${author}</li>`).join('')}
          </ul>
        </div>`
      : ''

    const photoBannerText = anyPhotos
      ? `\n*** PHOTO EVIDENCE TAKEN ***\nThe proctor indicated that picture(s) were captured on their device during this exam session.\nPlease contact the observing proctor(s) to obtain the photo evidence:\n${proctorAuthors.map((a) => ` - ${a}`).join('\n')}\n`
      : ''

    const notesHtml = reservation.notes
      .map((n, idx) => {
        const authorName = `${n.author.firstName} ${n.author.lastName}`.trim()
        const timeStr = new Date(n.createdAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })
        const photoTag = n.hasPhotos
          ? '<span style="color: #ef4444; font-weight: bold;">[Photo Captured]</span> '
          : ''
        return `<div style="border-left: 3px solid #3b82f6; padding: 8px 12px; margin-bottom: 12px; background-color: #f8fafc;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
            <strong>Note #${idx + 1}</strong> • ${timeStr} • Recorded by <strong>${authorName}</strong> ${photoTag}
          </div>
          <div style="font-size: 14px; color: #1e293b; white-space: pre-wrap;">${escapeHtml(n.content)}</div>
        </div>`
      })
      .join('')

    const notesText = reservation.notes
      .map((n, idx) => {
        const authorName = `${n.author.firstName} ${n.author.lastName}`.trim()
        const timeStr = new Date(n.createdAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })
        const photoTag = n.hasPhotos ? '[Photo Captured] ' : ''
        return `Note #${idx + 1} (${timeStr} by ${authorName}) ${photoTag}:\n${n.content}\n`
      })
      .join('\n')

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.5; color: #1e293b;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">CBTF Test Session Incident Report</h2>
        
        <p>This automated notification was generated upon exam checkout because one or more proctor observation notes were recorded for this test taker.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Student:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;"><strong>${studentName}</strong> (ID: ${studentIdStr})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Course:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${courseTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Assignment:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${assignmentTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Workstation:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">Seat #${seatNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Check-In:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${checkInTime}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Check-Out:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${checkOutTime}</td>
          </tr>
        </table>

        ${photoBannerHtml}

        <h3 style="color: #0f172a; margin-top: 24px; margin-bottom: 12px;">Proctor Notes (${reservation.notes.length})</h3>
        ${notesHtml}

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">
          Sent by ${reservation.facility.name} Testing Center Console.
        </p>
      </div>
    `

    const text = `
CBTF Test Session Incident Report
---------------------------------
Student:      ${studentName} (ID: ${studentIdStr})
Course:       ${courseTitle}
Assignment:   ${assignmentTitle}
Workstation:  Seat #${seatNumber}
Check-In:     ${checkInTime}
Check-Out:    ${checkOutTime}

${photoBannerText}
Proctor Notes (${reservation.notes.length}):
---------------------------------
${notesText}

---------------------------------
Sent by ${reservation.facility.name} Testing Center Console.
    `.trim()

    // 4. Send email via transporter
    try {
      const transporter = getEmailTransporter()
      const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : ({} as any)
      const fromEmail = config.email?.from || 'cbtf@example.edu'

      await transporter.sendMail({
        from: `"CBTF Testing Center" <${fromEmail}>`,
        to: recipients,
        subject,
        html,
        text
      })

      return true
    } catch (mailErr: any) {
      console.error('[CBTF Notification] Failed to dispatch incident email:', mailErr.message)
      return false
    }
  } catch (err: any) {
    console.error('[CBTF Notification] Error preparing incident email:', err.message)
    return false
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
