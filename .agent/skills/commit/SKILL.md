---
name: Project Commit
description: Stage and commit recent changes following GEMINI.md conventional commit rules, subject length constraints, and host execution protocols
---

# Project Commit Skill

<role>
You are an expert at inspecting, staging, and committing code changes for the `egp-broker` project.
Whenever the user asks to "stage and commit", "commit these changes", or upon completing an atomic development task,
you MUST consult and strictly follow the protocol in this skill.
</role>

---

## 1. Safety Checks & Diff Review

Before staging, inspect the working tree:

```bash
git status -s
git diff --stat
```

- Ensure ONLY files relevant to the current task are being committed.
- If unintended temporary files, test outputs, or unrelated changes exist, do not blindly stage everything (`git add -A`). Stage files selectively or remove unwanted artifacts.

---

## 2. Conventional Commit Formatting Rules

All commits in this repository must comply strictly with **GEMINI.md Section V.5**:

### A. Format

`<type>(<scope>): <subject>`

- **Allowed Types:**
  - `feat`: New feature or user-facing capability.
  - `fix`: Bug fix.
  - `docs`: Documentation changes only.
  - `style`: Changes that do not affect the meaning of the code (formatting, white-space).
  - `refactor`: Code change that neither fixes a bug nor adds a feature.
  - `perf`: Performance improvement.
  - `test`: Adding or correcting tests.
  - `build`: Changes to build system or dependencies.
  - `ci`: Changes to CI/CD configuration files.
  - `chore`: Maintenance tasks, repo configs, tool updates.
  - `revert`: Reverting a previous commit.

- **Scope:**
  - Optional, lowercase noun describing the module or component (e.g., `cbtf`, `gta`, `passes`, `auth`, `ui`, `dashboard`, `canvas`).
  - No spaces or special characters.

- **Subject Rules:**
  - Use **imperative mood**, lowercase start (e.g., `add user session timeout`, NOT `Added...` or `Adds...`).
  - **NO trailing period** at the end.
  - **NO markdown backticks** or backtick formatting anywhere in the subject.

### B. The 72-Character Hard Limit

- **The entire summary line (type + scope + subject) MUST NOT exceed 72 characters.**
- Aim for **50 characters or fewer** to prevent overflow.
- If your draft message exceeds 72 characters, aggressively summarize it before running `git commit`.

---

## 3. Host Execution & Linting Policy

1. **Host Execution:**
   - Git commands must **always be run on the HOST system** using `run_command` with `Cwd: "/Users/edwards/git/egp-broker"`.
   - **NEVER** run `docker compose exec app-dev git commit ...`.

2. **No Manual Project-Wide Linting:**
   - **NEVER** run manual project-wide lint or format passes (`pnpm run lint`, `eslint .`, `prettier`) before committing.
   - Husky automatically triggers `lint-staged` inside Docker when `git commit` executes.
   - If `lint-staged` fails during commit, inspect the specific error reported by Husky and fix only the targeted file.

---

## 4. Execution Commands

```bash
# Stage relevant files
git add <file1> <file2> ...
# or for atomic task changes:
git add -A

# Commit with valid message (<= 72 chars)
git commit -m "<type>(<scope>): <subject>"

# Verify the commit
git log -1 --oneline
```
