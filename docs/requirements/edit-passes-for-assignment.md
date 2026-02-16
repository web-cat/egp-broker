# Manual Pass Type ↔ Assignment Association: UI Options

## Context

Pass types specify a `titlePattern` (regex) to **auto-match** assignments. The `PassEligibility` join table tracks these links with an `isAutomatic` flag distinguishing pattern-matched from manual associations. Teachers need a way to **manually add or remove** pass type → assignment relationships beyond what patterns handle.

The teacher dashboard currently has:

- A **Pass Types** data table (with Edit/Delete actions per row)
- An **Assignments** data table (with Edit actions per row, eligible pass types shown as badge chips)
- Slideover edit panels for both entities ([PassTypeEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/PassTypeEditPanel.vue), [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue))

---

## Option A – Multi-Select in the Assignment Edit Panel

Add a multi-select field to the existing `AssignmentEditPanel` slideover. When editing an assignment, the teacher selects which pass types apply from a dropdown of all course pass types.

### Mockup

```
┌─────────────────── Edit Assignment ────────────────────┐
│ Title:            [Homework 3          ]               │
│ Due Date:         [2026-02-20 23:59    ]               │
│ Available From:   [2026-02-10 00:00    ]               │
│ Accept Until:     [2026-02-25 23:59    ]               │
│                                                        │
│ Eligible Pass Types:                                   │
│ ┌────────────────────────────────────────┐             │
│ │ ✕ Quiz Retry Pass (auto)              │             │
│ │ ✕ Late Day                            │             │
│ │   Search pass types…                  │             │
│ └────────────────────────────────────────┘             │
│                                                        │
│                          [Cancel]  [Save]              │
└────────────────────────────────────────────────────────┘
```

### Strengths

- **Most intuitive**: teachers think "this assignment should accept these passes"
- **Minimal new UI**: extends an existing panel — no new components needed
- **Clear visual**: auto-matched items can be tagged `(auto)` and disabled/locked
- **Atomic save**: eligibility changes are saved alongside other assignment edits

### Weaknesses

- **Per-assignment workflow**: associating the same pass type with 10 assignments requires opening 10 slideoverss
- **Doesn't help with bulk operations** when a new pass type should retroactively apply

---

## Option B – Multi-Select in the Pass Type Edit Panel

Add a multi-select field to the existing `PassTypeEditPanel` slideover. When editing a pass type, the teacher selects which assignments it applies to.

### Mockup

```
┌──────────────── Edit Pass Type ────────────────────────┐
│ Name:            [Quiz Retry Pass      ]               │
│ Initial Balance: [3                    ]               │
│ Hours/Pass:      [24                   ]               │
│ Title Pattern:   [^Quiz\s\d+$          ]               │
│  ...                                                   │
│                                                        │
│ Assigned Assignments:                                  │
│ ┌────────────────────────────────────────┐             │
│ │ ✕ Quiz 1 (auto)                       │             │
│ │ ✕ Quiz 2 (auto)                       │             │
│ │ ✕ Homework 3                          │             │
│ │   Search assignments…                 │             │
│ └────────────────────────────────────────┘             │
│                                                        │
│                          [Cancel]  [Save]              │
└────────────────────────────────────────────────────────┘
```

### Strengths

- **Bulk association**: one action applies a pass type to many assignments
- **Natural for "deploy new pass type"**: create a pass type, immediately assign it
- **Also extends an existing panel**: low UI overhead

### Weaknesses

- **Inverted mental model**: teachers likely think in terms of assignments, not pass types
- **Long lists**: courses with many assignments make the multi-select unwieldy
- **Assignment edit panel still has no visibility** into eligibility — inconsistency

---

## Option C – Inline Row Actions on the Assignments Table

Add a quick-action button (e.g., a ticket/link icon) directly in each assignment row. Clicking it opens a small popover or modal showing checkboxes for all course pass types, allowing toggle-on/toggle-off.

### Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│ Assignments                                          [+ Add]       │
├──────────────┬──────────────────┬────────────┬───────────┬─────────┤
│ Title        │ Pass Type(s)     │ Due Date   │ Available │ Actions │
├──────────────┼──────────────────┼────────────┼───────────┼─────────┤
│ Homework 3   │ 🎫 Late Day      │ Feb 20     │ Feb 10    │ 🔗 ✏️   │
│ Quiz 1       │ 🎫 Quiz Retry    │ Feb 18     │ Feb 08    │ 🔗 ✏️   │
└──────────────┴──────────────────┴────────────┴───────────┴─────────┘
                                                          ↓
                                               ┌──────────────────────┐
                                               │ Pass Type Eligibility│
                                               │ ☑ Quiz Retry (auto)  │
                                               │ ☐ Late Day           │
                                               │ ☐ Bonus Pass         │
                                               │         [Apply]      │
                                               └──────────────────────┘
```

### Strengths

- **Fastest workflow**: one click → popover → check → apply, without opening a full edit panel
- **Keeps context**: teacher stays on the table, can immediately see updated badge chips
- **Clear auto/manual distinction**: `(auto)` label on pattern-matched items; auto items can be shown as read-only

### Weaknesses

- **New component needed**: requires a custom popover/modal component
- **Limited space in popover**: problematic if there are many pass types
- **Not discoverable**: the link icon may not be immediately obvious to teachers

---

## Option D – Dedicated Eligibility Matrix View

Add a third section below the two tables: a matrix/grid where rows are assignments, columns are pass types, and each cell is a toggle. Auto-matched cells are visually distinct (e.g., filled with a different color).

### Mockup

```
┌────────────────── Pass Eligibility Matrix ─────────────────────────┐
│                  │ Quiz Retry  │ Late Day  │ Bonus Pass │          │
├──────────────────┼─────────────┼───────────┼────────────┤          │
│ Homework 1       │     ☐       │    ☑      │     ☐      │          │
│ Homework 2       │     ☐       │    ☑      │     ☐      │          │
│ Quiz 1           │    ☑ auto   │    ☐      │     ☐      │          │
│ Quiz 2           │    ☑ auto   │    ☐      │     ☑      │          │
│ Final Project    │     ☐       │    ☐      │     ☐      │          │
└──────────────────┴─────────────┴───────────┴────────────┴──────────┘
```

### Strengths

- **Complete visibility**: teacher sees the entire relationship landscape at a glance
- **Bulk editing**: toggling multiple cells is extremely fast
- **Clear auto vs. manual**: auto-matched cells use a distinct style

### Weaknesses

- **Scalability concern**: 50+ assignments × 5+ pass types creates a large, cluttered grid
- **Significant new component**: most complex to build and maintain
- **Redundant with table badges**: the assignment table already shows pass type chips, so this creates information duplication
- **Cognitive overload**: a third data-dense section on an already busy dashboard

---

## Recommendation: **Option A** — Multi-Select in the Assignment Edit Panel

> [!IMPORTANT]
> Option A is the best fit for this application.

### Rationale

| Factor              | Option A                       | Option B                       | Option C                | Option D             |
| ------------------- | ------------------------------ | ------------------------------ | ----------------------- | -------------------- |
| Mental model fit    | ✅ Assignment-centric          | ⚠️ Inverted                    | ✅ Assignment-centric   | ✅ Both              |
| Implementation cost | ✅ Low — extend existing panel | ✅ Low                         | ⚠️ Medium — new popover | ❌ High — new matrix |
| Scalability         | ✅ Few pass types per course   | ⚠️ Many assignments per course | ✅ Few pass types       | ❌ Poor with scale   |
| Discoverability     | ✅ In familiar Edit flow       | ✅ In familiar Edit flow       | ⚠️ Icon-based           | ⚠️ Separate section  |
| Bulk operations     | ⚠️ Per-assignment              | ✅ One-to-many                 | ⚠️ Per-assignment       | ✅ Matrix toggle     |
| Consistency         | ✅ Reuses existing UX pattern  | ✅ Reuses existing UX pattern  | ⚠️ New interaction      | ❌ New paradigm      |

**Why Option A wins:**

1. **Teachers think about assignments first.** The natural question is _"which passes can be used on this homework?"_ — not _"which assignments does this pass type cover?"_
2. **Pass types are few**: a course typically has 2-5 pass types vs. potentially dozens of assignments. A multi-select of 2-5 items is trivially usable; a multi-select of 50+ assignments (Option B) is not.
3. **Low implementation cost**: adding a `USelectMenu` to the existing `AssignmentEditPanel` requires minimal new code and no new components.
4. **The `isAutomatic` flag provides clear UX**: auto-matched items appear as locked/tagged chips, and only manually added items are removable. This prevents teachers from accidentally breaking pattern-based associations.

**When to revisit**: If teachers frequently need to apply a new pass type to many assignments at once, Option C's inline popover could be added later as a **complementary** quick-action. Options A and C are not mutually exclusive.
