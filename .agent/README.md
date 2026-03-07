# Get-Shit-Done for Antigravity

This directory contains workflows, templates, and references for structured project development.

## Usage

All workflows are accessible via Antigravity's `@[filename]` autocomplete.

**To use a workflow:**

Type `@[` and Antigravity will show available workflows.

Example: `@[define-requirements.md]`

## Available Workflows

See `workflows/` directory for all 20 workflows.

**Most common:**
- `define-requirements.md` - Extract requirements from PRD
- `create-roadmap.md` - Build phase-based roadmap
- `execute-phase.md` - Execute a project phase
- `verify-phase.md` - Verify phase completion
- `resume-project.md` - Continue after interruption

## Structure

```
.agent/
├── workflows/       # 20 workflow files
├── templates/       # Templates for planning docs
├── references/      # Reference documentation
└── README.md        # This file
```

## Next Steps

1. Create your `PRD.md` in project root
2. Use `@[define-requirements.md]` to start
3. Follow the workflow sequence

For full guide, see the adapter repository.
