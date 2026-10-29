# Deadline Detective — Web Application

**Group name:** Team Deadline Detectives  
**Course:** Mobile Application Development  
**Assignment:** Assignment 1 — Plan, Design and Prototype  
**Repository:** https://github.com/zayamshah25/DeadlineDetectiveWeb

## Group members
| Name | Student ID |
| Zayam Ali Shah | SE018 |
| Amina Zahoor | SE065 |
| Haseeb Ahmed | SE056 |

## Project description
Deadline Detective is a student-focused **web application** for organizing assignments and monitoring academic deadlines. Students can create and update coursework tasks, mark assignments complete, find upcoming or overdue work, and plan study time. A dashboard summarizes workload and progress. The goal is to reduce missed deadlines and help students manage coursework in one place.

**Target users:** university and college students managing multiple subjects and deadlines.  
**Value proposition:** one clear workspace for assignments, deadlines, priorities, and study planning.

## Planned features (MoSCoW)

### Must have
- Add, view, edit, and delete assignments (CRUD).
- Store assignment title, subject, due date, estimated study hours, and priority.
- Mark assignments complete or incomplete.
- Show assignments and their deadline status in a list.
- Persist records in a SQLite database through the backend.

### Should have
- Search, filter, and sort assignments.
- Study planner based on upcoming work.
- Dashboard statistics and progress summaries.
- Visual indicators for upcoming and overdue deadlines.

### Could have
- Student account login and session management (implemented in current prototype).
- Theme switching / dark mode (implemented in current prototype).
- Future reminder notifications or optional export.

### Won't have in the initial web scope
- Native Android/iOS application.
- Mobile emulator-based Hello World demo.
- Cloud synchronization or complex team collaboration.

## Chosen technology stack
| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, Vite 7, JavaScript, CSS | Browser-based user interface |
| Backend | Node.js, Express | REST API and authentication |
| Database | SQLite with `better-sqlite3` | Persistent server-side data |
| Version control | Git, GitHub | Team collaboration and submission |

**App type:** Web application, not a native or cross-platform mobile application. SQLite is stored on the server, **not on a phone**. The course's mobile-only requirements, if enforced, need instructor clarification; this README does not claim they have been completed.

## Setup instructions
**Requirements:** Node.js (recent LTS release), npm, Git, a web browser.

1. Clone the repository:
   ```bash
   git clone https://github.com/zayamshah25/DeadlineDetectiveWeb.git
   cd DeadlineDetectiveWeb
   ```
2. Start the backend in terminal 1:
   ```bash
   cd server
   npm install
   npm start
   ```
   Backend runs at `http://localhost:3000`. SQLite database is created automatically in `server/` when the server starts.
3. Start the frontend in terminal 2 (from the project root):
   ```bash
   cd client
   npm install
   npm run dev
   ```
4. Open the local URL shown by Vite (typically `http://127.0.0.1:5173`). Keep both terminals running.

**Troubleshooting:** If the frontend cannot load data, check that the backend is running on port 3000. The frontend currently points to `http://localhost:3000` in `client/src/App.jsx`. Do not upload your `.db` or `.env` files.

## Repository structure
```text
DeadlineDetectiveWeb/
├── client/                  # React/Vite web frontend
│   ├── src/
│   ├── index.html
│   └── package.json
├── server/                  # Express backend and SQLite integration
│   ├── server.js
│   └── package.json
├── docs/                    # Project documentation and evidence
│   ├── screenshots/         # Add actual screenshots here
│   └── wireframes/          # Web wireframe descriptions
├── .gitignore
└── README.md
```

## Design and project documentation
- [Web screen flow](docs/screen-flow.md)
- [Web wireframes](docs/wireframes/README.md)
- [Style guide](docs/style-guide.md)
- [Functional and nonfunctional requirements](docs/requirements.md)
- [Tech stack and alternatives](docs/tech-stack.md)
- [Project timeline, risks, and working agreement](docs/project-plan.md)
- [Team contributions and Git evidence](docs/team-contributions.md)
- [Submission checklist](docs/submission-checklist.md)


