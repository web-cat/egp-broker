---
description: Stage and commit recent changes following GEMINI.md conventional commit rules
---

# /commit Workflow

<objective>
Safely stage and commit changes on the host, strictly enforcing the conventional commit format, summary line length constraints (&le; 50-72 chars), and avoiding prohibited full-project lint passes.
</objective>

<process>

## 1. Inspect Working Tree

Inspect modified, deleted, and untracked files on the host:

```bash
git status -s
git diff --stat
```

Ensure only files relevant to the completed task are staged.

## 2. Draft Conventional Commit Message

Enforce the **GEMINI.md Section V.5** rules:

- **Format:** `<type>(<scope>): <subject>`
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Scope: lowercase, optional noun (e.g. `cbtf`, `gta`, `passes`, `auth`, `ui`).
- **Subject:**
  - Imperative mood, lowercase start (e.g., `add user session timeout`).
  - NO trailing period.
  - NO markdown backticks or backticks formatting.
- **Length Constraint:**
  - MUST NOT exceed 72 characters total (aim for 50 or fewer).

## 3. Execute Commit on Host

Execute git commands on the HOST machine (never inside the docker container):

```bash
git add -A
git commit -m "<type>(<scope>): <subject>"
```

_Note: Husky runs `lint-staged` automatically inside Docker during pre-commit. Do NOT run manual project-wide linting (`pnpm lint`) beforehand._

## 4. Confirm Commit Hash

Verify the commit succeeded:

```bash
git log -1 --oneline
```

</process>
