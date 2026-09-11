# Claude Code — Token-Lean + Manual Skills (English Instructions)

This package minimizes token usage by letting Main Claude handle small tasks, invoking agents only when useful, and keeping workflows as user-only manual skills that are not loaded until invoked.

User-facing responses are still configured to be in Thai unless requested otherwise.

## Install
Copy `CLAUDE.md` and `.claude/` to the project root.

## Normal usage
Use natural language; you do not need to name an agent. Example: `แก้ validation หน้าสร้างใบเสนอราคา`

## Manual Skills
- `/feature เพิ่มระบบ Purchase Request`
- `/bugfix login แล้ว session หายหลัง refresh`
- `/refactor แยก quotation form โดย behavior ต้องเหมือนเดิม`

All three skills use `disable-model-invocation: true`, so only the user can invoke them and their descriptions stay out of model context until invoked.

## Force a specific Agent when needed
- `@architect วิเคราะห์ architecture ก่อน ยังไม่ต้องแก้ code`
- `@researcher ตรวจ official docs ของ library นี้`
- `@developer implement งานนี้`
- `@debugger หา root cause ของ error นี้`
- `@qa ตรวจ regression ของ change นี้`

## Token-saving rules
1. Use Main Claude for small work.
2. Do not force a workflow for every task.
3. Use `/feature`, `/bugfix`, or `/refactor` when you want an explicit process.
4. Agents do not preload any skills.
5. Rules are path-scoped so they load only for matching files.
