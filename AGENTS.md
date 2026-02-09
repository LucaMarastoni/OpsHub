# AGENTS.md — Personal Ops Hub

## 1. Mission
This project is a self-hosted personal operations hub running on a Raspberry Pi.
The goal is clarity, speed, and long-term maintainability.
This is NOT a SaaS, NOT a demo, NOT a social product.

## 2. Stack & Constraints
- Node.js + Express
- SQLite (local file, no external DB)
- Minimal frontend: server-rendered HTML + vanilla JS or HTMX
- Use Tailwind CSS only if it stays lightweight
- Avoid heavy client frameworks (React, Vue, etc.)
- Must run well on low-resource hardware (Raspberry Pi)

## 3. Implementation Rules
- Prefer simple solutions over clever ones
- Do not add dependencies unless strictly necessary
- One feature at a time; no speculative abstractions
- Keep business logic out of views
- Validate all inputs, sanitize all outputs
- Fail loudly and clearly (no silent errors)

## 4. Code Style
- Clear naming > short naming
- Small, readable functions
- Comments only where intent is non-obvious
- No dead code
- Consistent formatting across files

## 5. UX Rules
- No animations unless they improve clarity
- Max 2 clicks to create content
- Mobile-first layouts
- Empty states must explain what to do
- Keyboard shortcuts are welcome but optional

## 6. AI Behavior
- If requirements are ambiguous, ask up to 3 questions before coding
- Do not invent features
- Do not refactor unrelated code
- When unsure, choose the simplest working solution
- Explain non-trivial decisions in commit messages or comments
