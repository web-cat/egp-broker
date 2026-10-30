# Plan 3.1 Summary: Assignment Duration Schema, Server Endpoints & Teacher Configuration UI

## Implementation Details

- **Shared Assignment Schemas**:
  - In `shared/models/assignment.ts`:
    - Updated `assignmentRowSchema` with `cbtfDurationMinutes: z.number().int().default(60)`.
    - Added `cbtfDurationMinutes: z.number().int().refine((val) => val === 30 || val === 60, { message: 'CBTF duration must be 30 or 60 minutes' }).optional()` to `createAssignmentSchema` and `updateAssignmentSchema`.
- **Database & Server Endpoints**:
  - In `server/utils/assignments.ts`, ensured `createAssignment` persists `cbtfDurationMinutes: data.cbtfDurationMinutes ?? 60`.
  - In `server/api/me/assignments/[id].patch.ts`, handled `cbtfDurationMinutes` in `prisma.assignment.update`.
- **Teacher & Admin Edit Panel**:
  - In `app/components/features/admin/AssignmentEditPanel.vue`:
    - Added reservation duration selector when `isSchedulable` is enabled (60 Minutes vs 30 Minutes).
    - Initialized and synced `state.cbtfDurationMinutes` from existing assignment or defaults to 60.
    - Included `cbtfDurationMinutes: state.isSchedulable ? (state.cbtfDurationMinutes || 60) : 60` in submit payload and `saved` event emission.
- **Unit Testing**:
  - In `test/unit/shared/schemas/assignment.schema.test.ts`, verified default duration (60), accepted durations (30, 60), and rejection of invalid values (45, 90, 15).
  - In `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts`, verified initialization of `cbtfDurationMinutes` and toggling to 30 minutes on click before form submit.
