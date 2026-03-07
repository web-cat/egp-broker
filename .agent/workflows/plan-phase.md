<purpose>
Create detailed execution plans (PLAN.md files) for a phase in your roadmap.

Breaks down phase requirements into concrete, executable tasks with verification steps.
</purpose>

<note>
This workflow has been updated for Antigravity. Original relied on gsd-planner agent.
</note>

<required_reading>
Read these files NOW:

1. @[.planning/ROADMAP.md] - See all phases
2. @[.planning/REQUIREMENTS.md] - All project requirements
3. @[.planning/STATE.md] - Current project state
4. Phase DISCOVERY.md if it exists (for context on this phase)
</required_reading>

<process>

<step name="identify_phase">
Determine which phase to plan:

```bash
cat .planning/ROADMAP.md
```

Find the phase marked "In progress" or "Not started" that needs plans.

Ask user: "Which phase should I plan? (e.g., 01-foundation)"
</step>

<step name="load_requirements">
Load requirements for this phase:

```bash
# From ROADMAP.md, find which requirements map to this phase
grep "Phase" .planning/ROADMAP.md
```

Identify:
- Which REQ-IDs belong to this phase
- Phase objectives
- Success criteria for the phase
</step>

<step name="load_context">
If phase has DISCOVERY.md or CONTEXT.md, read it:

```bash
cat .planning/phases/XX-name/DISCOVERY.md 2>/dev/null
cat .planning/phases/XX-name/CONTEXT.md 2>/dev/null
```

This tells you the user's vision for how this phase should work.
</step>

<step name="group_work">
Group the phase requirements into logical implementation units (plans).

**Principles:**
- Each plan = 2-5 related tasks
- Group by technical area (e.g., "Database schema", "API endpoints", "Frontend components")
- Plans should be independently testable
- Aim for 3-6 plans per phase

**Example grouping:**

Phase: 01-foundation  
Requirements: AUTH-01, AUTH-02, AUTH-03, DB-01, DB-02

Plans:
1. Database setup (DB-01, DB-02)
2. Auth backend (AUTH-01, AUTH-02)
3. Auth frontend (AUTH-03)
</step>

<step name="determine_sequence">
Analyze dependencies between plans:

- Which plans must come first?
- Which plans can run in parallel?
- Are there blocking dependencies?

Number plans: 01-01, 01-02, 01-03, etc.

Present sequence to user:
```
Phase 01 plans:

01-01: Database setup (DB-01, DB-02)
01-02: Auth backend (AUTH-01, AUTH-02) [depends on 01-01]
01-03: Auth frontend (AUTH-03) [depends on 01-02]

Is this sequence correct? (yes/adjust)
```
</step>

<step name="write_plans">
For each plan, create `{phase}-{plan}-PLAN.md` in the phase directory.

**PLAN.md structure:**

```markdown
# Plan: {Phase Name} - {Plan Name}

## Objective

[What this plan accomplishes in 1-2 sentences]

## Requirements Addressed

- [ ] **{REQ-ID}**: {requirement description}
- [ ] **{REQ-ID}**: {requirement description}

## Context Files

Read these before starting:
- @[.planning/STATE.md]
- @[.planning/ROADMAP.md]
- @[path/to/relevant/file.ext]

## Tasks

<task name="task_1" type="auto">
**What:** [Clear description of what to build]

**How:**
1. [Specific implementation step]
2. [Specific implementation step]
3. [Specific implementation step]

**Files to modify:**
- `path/to/file.ext` - [what changes]
- `path/to/new-file.ext` - [create this]

**Verification:**
```bash
# Command to verify this task worked
npm test -- task-1.test
```

**Done when:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests passing
</task>

<task name="task_2" type="auto">
[... similar structure ...]
</task>

[Optional checkpoint between tasks]
<task name="verify_setup" type="checkpoint:human-verify">
**What to verify:**
- Database tables created correctly
- Migrations applied

**How to verify:**
1. Check database with: `psql -d mydb -c "\dt"`
2. Verify schema matches design

If approved, continue. If issues, fix before proceeding.
</task>

<task name="task_3" type="auto">
[... continues ...]
</task>

## Success Criteria

At plan completion:
- [ ] All requirement checkboxes above marked done
- [ ] All task verifications pass
- [ ] Integration tests pass
- [ ] No breaking changes to existing features

## Commit Message Template

```
feat({phase}): {brief summary}

{phase}-{plan}: {more details}

Requirements: {REQ-ID}, {REQ-ID}
```
```

**Key sections:**
- **Objective** - What we're building
- **Requirements** - Which REQ-IDs this addresses  
- **Context Files** - What to read first (using @[syntax])
- **Tasks** - Step-by-step implementation
- **Success Criteria** - How to know it's done
</step>

<step name="review_plans">
Present all plan files to user:

```
Created plans for Phase {XX}:

{phase}-01-PLAN.md: {name}
  - Requirements: {list}
  - Tasks: {count}

{phase}-02-PLAN.md: {name}
  - Requirements: {list}
  - Tasks: {count}

[... all plans ...]

Ready to commit? (yes/revise)
```
</step>

<step name="commit">
Commit all PLAN.md files:

```bash
git add .planning/phases/{phase}/
git commit -m "docs: create execution plans for {phase}

{X} plans created
Requirements covered: {list}
"
```
</step>

<step name="update_state">
Update @[.planning/STATE.md]:
- Mark phase as "planned"
- Note number of plans created
- Update current position
</step>

<step name="next_steps">
Present next actions:

```
✅ Phase {XX} plans created!

Plans: {count}
Requirements covered: {X/Y}

---

Next:
- Review plans if needed
- Execute first plan: @[execute-plan.md]
- Or plan next phase if desired
```
</step>

</process>

<quality_criteria>
**Good plans:**
- 2-5 tasks each (focused scope)
- Clear, specific implementation steps
- Verification for each task
- Proper sequencing/dependencies

**Bad plans:**
- Too many tasks (>6)
- Vague instructions ("Set up auth")
- Missing verification steps
- Circular dependencies
</quality_criteria>

<success_criteria>
- [ ] Phase identified
- [ ] Requirements loaded
- [ ] Work grouped logically
- [ ] Dependencies analyzed
- [ ] All PLAN.md files created
- [ ] Plans committed to git
- [ ] STATE.md updated
</success_criteria>

<antigravity_tips>
**Antigravity-specific best practices:**

1. **Use @ syntax** - Link to files with @[filename] for autocomplete
2. **Clear structure** - PLAN.md files are instructions to future-you
3. **Checkpoints** - Use them when you need human verification/decisions
4. **Keep focused** - 2-5 tasks per plan is the sweet spot
5. **Test-driven** - Add verification commands for each task
</antigravity_tips>
