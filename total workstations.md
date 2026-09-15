Under the admin dashboard's testing center page, I have one facility with a name a seating capacity, and other information entered. This information must be properly stored, since it is reloaded each time I visit the page, even after an app restart. However, when I go to the proctor dashboard, the total seats is not properly retrieved. In the title bar underneath the name "Testing Center Console", it says "- Total Workstations", leaving a dash instead of the actual number. In the "Seated" chip in the title bar, it says "0/-", again using a dash instead of the actual number. Why is this happening? Also, the "Departing Soon" count does not appear to reflect near-term departures, at least not in training mode. In training mode when users are departing soon, their remaining time appears in yellow (a warning color), but the "Departing Soon" count does not reflect them.

---

Here is why both of these issues are occurring:

---

### 1. Why Total Workstations Displays `—` and Name Defaults to "Testing Center Console"

#### Root Cause: A Status Enum Mismatch in the Database Query Causes `/api/proctor/feed` to Crash (500 Error)

1. **The Fallback Behavior:**
   In [`ProctorConsole.vue`](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue#L559-L563), the title bar and chips use fallback values when `currentFacility.value` is unpopulated:

   ```typescript
   const currentFacility = computed(() => unwrapState<any>(props.proctorState.facility))
   const totalSeats = computed(() => currentFacility.value?.totalSeats ?? '—')
   const facilityName = computed(() => currentFacility.value?.name || 'Testing Center Console')
   ```

   When `currentFacility` is undefined, the facility name defaults to `'Testing Center Console'`, `totalSeats` defaults to `'—'`, and the Seated chip evaluates to `0 / —`.

2. **Why `currentFacility` Is Undefined:**
   On the live proctor page (`/proctor`), [`useCbtfProctor()`](file:///Users/edwards/git/egp-broker/app/composables/features/proctor/useCbtfProctor.ts#L11-L26) calls `useFetch('/api/proctor/feed')`.
   In [`server/api/proctor/feed.get.ts`](file:///Users/edwards/git/egp-broker/server/api/proctor/feed.get.ts#L23), it calls `getProctorLiveFeed(prisma)`.

3. **The Schema vs. Code Enum Conflict:**
   Inside [`getProctorLiveFeed` in `server/utils/cbtf.ts`](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts#L740-L750):

   ```typescript
   const reservations = await prisma.cbtfReservation.findMany({
     where: {
       facilityId: facility.id,
       OR: [
         { status: 'CHECKED_IN' },
         { status: 'SCHEDULED', ... },
         {
           status: 'CHECKED_OUT', // ❌ Root Cause: Invalid Enum Value
           checkedOutAt: { gte: new Date(now.getTime() - 30 * 60000) }
         }
       ]
     },
     ...
   ```

   However, in [`prisma/schema.prisma`](file:///Users/edwards/git/egp-broker/prisma/schema.prisma#L567-L573) and the PostgreSQL migration (`20260902213500_add_cbtf_scheduler_models`):

   ```prisma
   enum CbtfReservationStatus {
     SCHEDULED
     CHECKED_IN
     COMPLETED
     MISSED
     CANCELLED
   }
   ```

   The database enum defines **`COMPLETED`**, not `CHECKED_OUT`.

   When Prisma generates the SQL query against PostgreSQL, Prisma Client validation and Postgres reject `'CHECKED_OUT'` as an invalid enum value, throwing a query error. This causes `/api/proctor/feed` to return a **500 Internal Server Error**. Because `useFetch` fails silently without an error toast, `feedData` remains empty and the UI displays the fallback placeholders.

   _(Note: The same `'CHECKED_OUT'` value is also used in [`checkOutReservation`](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts#L1084) and [`server/api/admin/cbtf/reservations/[id].patch.ts`](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/reservations/[id].patch.ts#L22). Either a migration is needed to add `CHECKED_OUT` to `CbtfReservationStatus`, or the code needs to be standardized on `COMPLETED`.)_

---

### 2. Why "Departing Soon" Does Not Reflect Near-Term Departures in Training Mode

#### Root Cause: Training Mode Only Counts Explicitly Checked-Out Students in `departures`

1. **The In-Memory Training State:**
   In [`useCbtfProctorTraining.ts`](file:///Users/edwards/git/egp-broker/app/composables/features/proctor/useCbtfProctorTraining.ts#L61-L225):

   ```typescript
   const seated = ref<FictionalReservation[]>([])
   const arriving = ref<FictionalReservation[]>([])
   const departures = ref<FictionalReservation[]>([])
   ...
   departures.value = [] // Initialized empty
   ...
   const counts = computed(() => ({
     seated: seated.value.length,
     arriving: arriving.value.length,
     departures: departures.value.length
   }))
   ```

   In `useCbtfProctorTraining`, `departures.value` only receives reservations when `confirmCheckOut()` is executed.

2. **The Yellow Warning vs. Departures Calculation:**
   In `buildInitialScenario()`, student Aaliyah Patel is seated with `remainingMinutes: 7`.
   In [`ProctorConsole.vue`](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue#L750-L765), the table cell checks `remaining <= 10`, so her remaining time pulses yellow (`bg-amber-100 text-amber-800 animate-pulse`).

   However, unlike the backend logic in `getProctorLiveFeed` (which includes seated students whose `remainingMinutes <= 10` in `departures`), `useCbtfProctorTraining.ts`:
   - Does not include seated students whose `remainingMinutes <= 10` in the `departures` list.
   - Calculates `counts.departures` solely as `departures.value.length` (which is `0` until a proctor clicks "Check Out").

   As a result, near-term departures show in yellow in the seated roster table, but the "Departing Soon" KPI chip and Departures tab show `0`.

---

### Summary of Fixes Needed in `egp-broker`

1. **To fix Total Workstations & Proctor Console retrieval:**
   - Align the status enum between the database and the code: either add `CHECKED_OUT` to the Prisma `CbtfReservationStatus` enum via a migration, or replace `CHECKED_OUT` with `COMPLETED` in `server/utils/cbtf.ts` and related routes.
   - Add error handling / error toast in `useCbtfProctor.ts` if `/api/proctor/feed` fails so errors are surfaced immediately.
2. **To fix the "Departing Soon" count in Training Mode:**
   - In `useCbtfProctorTraining.ts`, compute the departures roster and count dynamically by combining seated students with `remainingMinutes <= 10` (status `'CHECKED_IN'` / Ending Soon) along with already checked-out students, matching the server-side feed specification.
