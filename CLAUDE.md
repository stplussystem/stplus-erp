# Office ERP — Claude Code

## Global rules
- Respond to the user in Thai unless requested otherwise; keep code and identifiers in English.
- Modify only the requested scope and directly related files. Report out-of-scope issues; do not fix them automatically.
- Require concrete evidence such as errors, logs, tests, or diffs before claiming a root cause.
- Preserve existing architecture and patterns. Avoid new dependencies or major structural changes unless necessary.
- Run only the relevant test/lint/build checks after changes.
- For files containing Thai text, never use PowerShell `Get-Content`/`Set-Content`; use Read/Edit/Write.

## Frontend
- หน้า Next.js ใหม่/ที่แก้ไขใน `system-frontend` ต้องตาม `.claude/docs/frontend-page-template.md` (padding/title, ปุ่ม, การใช้ AppSelect/AppLoading/AppDatePicker, validation error)

## Token discipline
- Main Claude handles small tasks. Use subagents only when isolation or specialization adds real value.
- Do not invoke multiple agents by default. Research, debugging, and QA are conditional.
- Read only relevant files; avoid repository-wide scans unless required.
- Keep summaries short: changes → files → verification → remaining issues.
