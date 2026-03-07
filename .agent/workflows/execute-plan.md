<purpose>
Execute a phase plan and create the outcome summary.

This workflow guides you through implementing the tasks in a PLAN.md file, handling deviations automatically, and documenting results.
</purpose>

<required_reading>
Read @[.planning/STATE.md] before starting to load project context.
</required_reading>

<process>

<step name="load_state">
Check current project state:

```bash
cat .planning/STATE.md
```

This tells you:
- Current phase and plan
- Previous decisions
- Known blockers
</step>

<step name="identify_plan">
Find the plan to execute:

```bash
# Check roadmap for current phase
cat .planning/ROADMAP.md

# List plans in current phase
ls .planning/phases/XX-name/*-PLAN.md

# Identify first plan without SUMMARY
ls .planning/phases/XX-name/*-SUMMARY.md
```

**Logic:** Find first PLAN file without matching SUMMARY file.

Example: If `01-01-PLAN.md` exists but `01-01-SUMMARY.md` doesn't → execute 01-01
</step>

<step name="confirm">
Present to user:

```
Found plan to execute: {phase}-{plan}-PLAN.md

Proceed with execution? (yes/no)
```

Wait for confirmation.
</step>

<step name="load_plan">
Read the plan file:

```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

The plan contains:
- **Objective:** What you're building
- **Context files:** Files to read first
- **Tasks:** Step-by-step implementation
- **Verification:** How to test
- **Success criteria:** What "done" looks like
</step>

<step name="execute_tasks">
For each task in the plan:

**If task type="auto":**
1. Read any @context files mentioned
2. Implement the task
3. If you hit an authentication error → pause and ask user to authenticate
4. If you discover additional work → apply deviation rules (see below)
5. Run the verification for that task
6. Commit the task changes:
   ```bash
   git add [files]
   git commit -m "task: [brief description]"
   ```
7. Track commit hash for summary

**If task type="checkpoint:human-verify":**
1. STOP immediately
2. Show user what to verify:
   ```
   ╔═══════════════════════════════════════╗
   ║  CHECKPOINT: Verification Required     ║
   ╚═══════════════════════════════════════╝
   
   Task: [task name]
   Built: [what was created]
   
   How to verify:
   1. [step 1]
   2. [step 2]
   
   → Type "approved" or describe issues
   ```
3. Wait for user response
4. Only continue after approval

**If task type="checkpoint:decision":**
1. STOP immediately
2. Present the decision clearly
3. Wait for user to decide
4. Use their decision for remaining tasks
</step>

<step name="handle_deviations">
**While executing, you WILL discover work not in the plan. This is normal.**

Apply these rules automatically:

**Auto-fix (no permission needed):**
- Bugs in the code (broken behavior, errors, security issues)
- Critical missing functionality (error handling, null checks, validation)
- Blocking issues (missing dependencies, broken imports, config errors)

**Ask first:**
- Architectural changes (new database tables, switching libraries)
- Breaking API changes
- New infrastructure

Track ALL deviations for the summary.
</step>

<step name="verify">
After all tasks complete, run overall verification:

```bash
# Run tests
npm test  # or appropriate test command

# Check build
npm run build  # if applicable

# Verify success criteria from plan
```

Confirm all success criteria are met.
</step>

<step name="create_summary">
Create `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`:

```markdown
# Summary: {Phase} - {Plan}

**Objective:** [from plan]

**Completed:** [date]

## Tasks Completed

1. ✅ [Task 1 description]
   - Commit: [hash]
   - Files: [list]

2. ✅ [Task 2 description]
   - Commit: [hash]
   - Files: [list]

[... all tasks ...]

## Deviations

**Auto-applied:**
- [Deviation 1]: [description]
- [Deviation 2]: [description]

**User decisions:**
- [Decision from checkpoint]: [what was decided]

## Verification

✅ All tests passing
✅ Build successful
✅ Success criteria met

## Next Steps

[Phase complete] → Move to next phase
[More plans] → Execute plan {next-plan}
```
</step>

<step name="commit_summary">
Commit the summary:

```bash
git add .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
git commit -m "docs: complete {phase}-{plan}

Tasks: [X] completed
Deviations: [Y] auto-fixed
"
```
</step>

<step name="update_state">
Update @[.planning/STATE.md] with:
- Completed plan marked as done
- Any new decisions or constraints
- Current position in roadmap
</step>

<step name="report">
Present completion:

```
✅ Plan {phase}-{plan} complete!

Tasks completed: [X]
Commits: [Y]
Deviations: [Z] (see SUMMARY.md)

Summary: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md

---

Next: 
- More plans in this phase? Execute next plan
- Phase complete? Run @[verify-phase.md]
```
</step>

</process>

<quality_criteria>
**Good execution:**
- All tasks completed as specified
- Deviations documented
- Tests passing
- Summary clear and accurate

**Bad execution:**
- Skipped tasks
- Undocumented deviations  
- Broken tests
- Vague summary
</quality_criteria>

<success_criteria>
- [ ] Plan loaded and understood
- [ ] All tasks executed
- [ ] Checkpoints handled properly
- [ ] Deviations tracked
- [ ] Verification passed
- [ ] SUMMARY.md created
- [ ] Summary committed to git
- [ ] STATE.md updated
</success_criteria>

<antigravity_tips>
**Antigravity-specific best practices:**

1. **Context:** Use `/clear` before starting if context is getting full
2. **File refs:** Use @[filename] syntax - Antigravity autocompletes
3. **Git:** Antigravity runs git commands directly - just propose them
4. **Checkpoints:** Present clearly and wait for user input
5. **Deviations:** Track everything for transparency in SUMMARY
6. **Commits:** Commit after each task for granular history
</antigravity_tips>
