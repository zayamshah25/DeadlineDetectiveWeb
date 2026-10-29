# Deadline Detective Web

**Project:** Responsive Web-Based Assignment and Study Planner  
**Course:** Mobile Application Development (instructor-approved web development adaptation)  
**Assignment:** Assignment 1 - Plan, Design and Prototype  
**Group name / number:** Deadline Detective Web

## Group Members

| Name | Student ID |
|---|---|
| Zayam Ali Shah | SE018 |
| Amina Zahoor | SE065 |
| Haseeb Ahmed | SE0056 |

## Project Description

Deadline Detective 2.0 is a responsive web application for university students to organize assignments, monitor deadlines, plan study time and track progress. Students can add, edit, delete, search, filter and complete assignments. The dashboard highlights approaching deadlines and Rescue Mode helps students identify urgent tasks. The Study Planner produces a timetable based on available hours and study-session preferences.

## Target Users

University students managing coursework across multiple subjects.

## Features (MoSCoW)

### Must Have
- Create assignments with title, subject, deadline and estimated hours.
- View assignments and their completion status.
- Edit and delete assignments.
- Mark assignments completed or undo completion.
- Search, filter and sort assignments.
- Persist assignments in Cloud Firestore with user-specific security rules.

### Should Have
- Daily study timetable with planned sessions and breaks.
- Rescue Mode for urgent tasks.
- In-app deadline warnings while the website is open.
- Progress statistics and analytics.

### Could Have
- Student registration, login and profile management.
- Additional interface polish and accessibility improvements.

## Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES modules)
- **Authentication:** Firebase Authentication
- **Database:** Cloud Firestore
- **Charts:** Chart.js
- **Development:** Visual Studio Code, Live Server, browser DevTools
- **Version control:** Git and GitHub
- **Hosting option:** Netlify static hosting

This is a browser-based web application, not a native Android or iOS application. The original mobile assignment's local database and emulator requirements are replaced by a cloud-backed web workflow as agreed with the instructor.

## Project Structure

```text
Deadline Detective 2.0/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── assignments.html
├── planner.html
├── analytics.html
├── profile.html
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── assignments.css
│   ├── planner.css
│   ├── analytics.css
│   └── profile.css
├── js/
│   ├── firebase.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── assignments.js
│   ├── planner.js
│   ├── analytics.js
│   └── profile.js
└── assets/
    └── images/
```

Additional CSS and JavaScript files may exist in the working project.

## Setup Instructions

1. Install **Visual Studio Code** and the **Live Server** extension.
2. Download or clone the repository and open its root folder in VS Code.
3. Create a Firebase project, enable **Authentication** (Email/Password) and **Cloud Firestore**, and configure the project's web Firebase settings in `js/firebase.js`.
4. Publish appropriate user-scoped Firestore security rules. Never use unrestricted production rules.
5. Add the local development hostname and any deployed hostname to Firebase Authentication's authorized domains when needed.
6. Right-click `index.html` and select **Open with Live Server**.
7. Register a test account and verify the dashboard, assignments, planner and analytics pages.

> Do not open the HTML files directly with `file://`; ES module imports and authentication should be tested using a local HTTP server.

## How to Use

1. Open the website and create an account or sign in.
2. Add an assignment with its subject, deadline and estimated hours.
3. View or update assignments and mark completed work.
4. Use the dashboard to see progress and deadline alerts.
5. Generate a daily study plan and review analytics.
6. Open Profile to manage account details.

## Repository and Contribution Evidence

**Repository URL:** https://github.com/zayamshah25/DeadlineDetectiveWeb

Each member should make at least one genuine commit from their own GitHub account and record what they contributed. Attach the repository and commit-history screenshots to the assignment report.

## Planned Semester Work

- **Assignment 2:** Responsive UI and navigation.
- **Assignment 3:** Firebase data persistence, CRUD, validation, search and study planning.
- **Assignment 4:** Rescue Mode, deadline alerts, testing, polish and documentation.

## Known Limitations

- Cloud Firestore requires connectivity for reliable server synchronization; offline persistence is not claimed.
- Deadline reminders are in-app alerts and do not deliver push notifications when the browser is closed.
- Actual GitHub URL, group number and member commit evidence must be added before submission.

## References and Tools

- [Firebase Documentation](https://firebase.google.com/docs)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [GitHub Documentation](https://docs.github.com/)
- ChatGPT (OpenAI) was used for drafting and development assistance; the group reviews the final submission.
