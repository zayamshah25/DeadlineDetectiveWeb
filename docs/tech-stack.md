# Technology selection and comparison

**Chosen:** React + Vite frontend, Node.js + Express backend, SQLite database. **Classification:** web application.

Reasons: (1) React supports reusable UI components and rapid iteration; (2) Vite provides a lightweight local development workflow; (3) Express and SQLite allow a straightforward CRUD API and persistent task storage.

| Criterion | Chosen web stack (React/Vite + Express/SQLite) | Alternative (Django + templates/SQLite) |
|---|---|---|
| UI | Client-side interactive React components | Server-rendered templates by default |
| Backend language | JavaScript | Python |
| Persistence | SQLite via `better-sqlite3` | SQLite via Django ORM |
| Strength | Shared JavaScript across frontend/backend | Integrated framework and admin tools |
| Trade-off | Two development servers to run | Different frontend interaction approach |

**Not a mobile stack.** This comparison does not satisfy a required mobile-framework comparison if the instructor insists on a mobile submission.
