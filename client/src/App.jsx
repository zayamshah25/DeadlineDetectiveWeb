
import { useEffect, useRef, useState } from 'react'
import AuthScreen from './AuthScreen.jsx'
import './App.css'
import Sidebar from './components/Sidebar.jsx'
import StudyPlanner from './components/StudyPlanner.jsx'
import { buildStudyPlan } from './utils/studyPlan.js'
import { getSection, compareAssignments, isDueSoon, timeRemaining } from './utils/assignmentStatus.js'

const BASE = 'http://localhost:3000'
const API = `${BASE}/api/assignments`
async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' })
  if (response.status === 401) window.dispatchEvent(new Event('dd:unauthorized'))
  return response
}

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 }
const byId = (a, b) => Number(a.id) - Number(b.id)

// Sort options for the assignment lists. Ties fall back to the default order.
const SORTERS = {
  'deadline-asc': compareAssignments,
  'deadline-desc': (a, b) => b.deadline.localeCompare(a.deadline) || byId(a, b),
  priority: (a, b) =>
    (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
    compareAssignments(a, b),
  title: (a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || byId(a, b),
  'hours-desc': (a, b) => Number(b.hours) - Number(a.hours) || compareAssignments(a, b),
}

function getDeadlineStatus(deadline, completed) {
  if (completed) {
    return { label: 'Completed', className: 'completed' }
  }

  // Use local calendar dates to avoid timezone-related date shifts.
  const today = new Date()
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const [year, month, day] = deadline.split('-').map(Number)
  const dueDate = new Date(year, month - 1, day)
  const daysLeft = Math.round(
    (dueDate.getTime() - todayDate.getTime()) / 86400000
  )

  if (daysLeft < 0) {
    return { label: 'Overdue', className: 'overdue' }
  }

  if (daysLeft === 0) {
    return { label: 'Due Today', className: 'due-today' }
  }

  if (daysLeft <= 3) {
    return {
      label: daysLeft === 1 ? 'Due Tomorrow' : `Due in ${daysLeft} days`,
      className: 'due-soon',
    }
  }

  return { label: 'Upcoming', className: 'upcoming' }
}

function DashboardApp({ user, onLogout }) {
  const [darkMode, setDarkMode] = useState(
  () => localStorage.getItem('dd-theme') === 'dark'
)

useEffect(() => {
  document.documentElement.setAttribute(
    'data-theme',
    darkMode ? 'dark' : 'light'
  )
  localStorage.setItem('dd-theme', darkMode ? 'dark' : 'light')

  return () => {
    document.documentElement.removeAttribute('data-theme')
  }
}, [darkMode])
  const [assignments, setAssignments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [deadline, setDeadline] = useState('')
  const [hours, setHours] = useState('2')
  const [priority, setPriority] = useState('Medium')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availableHours, setAvailableHours] = useState('4')
  const [studyStartTime, setStudyStartTime] = useState('14:00')
  const [planGenerated, setPlanGenerated] = useState(false)
  const [view, setView] = useState('dashboard')
  const [navOpen, setNavOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('deadline-asc')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const formRef = useRef(null)
  const dialogRef = useRef(null)
  const deleteTriggerRef = useRef(null)
  
  async function loadAssignments() {
    try {
      const response = await apiFetch(API)
      if (!response.ok) throw new Error('Could not load assignments')

      const data = await response.json()
      setAssignments(data)
    } catch (error) {
      setMessage(
        'Backend se connection nahi ho raha. Check karo ke server chal raha hai.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  // Bring the form into view when an assignment is opened for editing.
  useEffect(() => {
    if (editingId !== null) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingId])

  // Delete dialog: Escape closes it (unless a delete is in progress) and Tab
  // stays inside it.
  useEffect(() => {
    if (!deleteTarget) return
    function onKey(event) {
      if (event.key === 'Escape' && !deleting) {
        setDeleteTarget(null)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll('button:not(:disabled)')
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget, deleting])

  // When the dialog closes, give focus back to the button that opened it
  // (if that button still exists, e.g. after Cancel).
  useEffect(() => {
    if (deleteTarget) return
    const trigger = deleteTriggerRef.current
    deleteTriggerRef.current = null
    if (trigger && trigger.isConnected) trigger.focus()
  }, [deleteTarget])

  const pending = assignments.filter(item => !item.completed).length
  const completed = assignments.filter(item => Boolean(item.completed)).length

  const completionPercentage = assignments.length === 0
  ? 0
  : Math.round((completed / assignments.length) * 100)

  const remainingHours = assignments
  .filter(item => !item.completed)
  .reduce((total, item) => total + Number(item.hours), 0)

  const overdue = assignments.filter(
    item => !item.completed &&
      getDeadlineStatus(item.deadline, false).className === 'overdue'
  ).length

  const now = new Date()
  const sectionOf = item => getSection(item, now)
  const counts = {
    assignments: assignments.length,
    upcoming: assignments.filter(i => sectionOf(i) === 'upcoming').length,
    pastdue: assignments.filter(i => sectionOf(i) === 'pastDue').length,
    completed: assignments.filter(i => sectionOf(i) === 'completed').length,
  }
  const viewTitles = {
    dashboard: 'My Assignments',
    assignments: 'My Assignments',
    upcoming: 'Upcoming / Pending',
    pastdue: 'Past Due',
    completed: 'Completed',
  }
  const sectionForView = { upcoming: 'upcoming', pastdue: 'pastDue', completed: 'completed' }
  const viewItems = assignments.filter(
    i => !sectionForView[view] || sectionOf(i) === sectionForView[view]
  )
  const query = search.trim().toLowerCase()
  const filtersActive =
    query !== '' ||
    priorityFilter !== 'All' ||
    (view === 'assignments' && statusFilter !== 'All')
  const visibleAssignments = viewItems
    .filter(i => !query ||
      i.title.toLowerCase().includes(query) ||
      i.subject.toLowerCase().includes(query))
    .filter(i => priorityFilter === 'All' || i.priority === priorityFilter)
    .filter(i => view !== 'assignments' || statusFilter === 'All' || sectionOf(i) === statusFilter)
    .sort(SORTERS[sortBy] ?? compareAssignments)

  const dueSoonCount = assignments.filter(i => isDueSoon(i, now)).length
  const activeSorted = assignments.filter(i => !i.completed).sort(compareAssignments)
  const priorityList = activeSorted.slice(0, 4)
  const upcomingList = activeSorted.filter(i => sectionOf(i) === 'upcoming').slice(0, 5)
  const dashPlan = planGenerated ? buildStudyPlan(assignments, availableHours, studyStartTime) : null
  const planSlots = dashPlan ? dashPlan.timetable.filter(s => s.type === 'task').slice(0, 4) : []
  const todayLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setSubject('')
    setDeadline('')
    setHours('2')
    setPriority('Medium')
  }

  function cancelForm() {
    resetForm()
    setShowForm(false)
  }

  function clearFilters() {
    setSearch('')
    setPriorityFilter('All')
    setStatusFilter('All')
  }

  function openNewAssignment() {
    resetForm()
    clearFilters()
    setView('assignments')
    setShowForm(true)
    setNavOpen(false)
    window.scrollTo(0, 0)
  }

  function navigate(next) {
    clearFilters()
    setView(next)
    setNavOpen(false)
    window.scrollTo(0, 0)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setTitle(item.title)
    setSubject(item.subject)
    setDeadline(item.deadline)
    setHours(String(item.hours))
    setPriority(item.priority)
    setShowForm(true)
    setMessage('')
  }

  async function saveAssignment(event) {
    event.preventDefault()
    const isEditing = editingId !== null
    setSaving(true)
    setMessage('')

    try {
      const response = await apiFetch(isEditing ? `${API}/${editingId}` : API, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          deadline,
          hours: Number(hours),
          priority,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Save failed')

      setAssignments(current =>
        isEditing
          ? current.map(item => item.id === data.id ? data : item)
          : [...current, data]
      )
      resetForm()
      setShowForm(false)
      setMessage(isEditing ? 'Assignment updated.' : 'Assignment database mein save ho gayi!')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleComplete(target) {
    const id = target.id
    try {
      const response = await apiFetch(`${API}/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !target.completed }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Update failed')

      setAssignments(current =>
        current.map(item => item.id === id ? data : item)
      )
      setMessage('Assignment status updated.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleting(true)

    try {
      const response = await apiFetch(`${API}/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Delete failed')

      setAssignments(current => current.filter(item => item.id !== id))
      if (editingId === id) cancelForm()
      setMessage('Assignment deleted from database.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  function findNextTask() {
    const remaining = assignments
      .filter(item => !item.completed)
      .sort((a, b) => {
        const dateDifference = a.deadline.localeCompare(b.deadline)
        if (dateDifference !== 0) return dateDifference

        const score = { High: 3, Medium: 2, Low: 1 }
        return score[b.priority] - score[a.priority]
      })

    if (remaining.length === 0) {
      setMessage('No pending assignments. You are all caught up!')
    } else {
      setMessage(
        `Next task: ${remaining[0].title} (${remaining[0].subject}), due ${remaining[0].deadline}.`
      )
    }
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={navigate} counts={counts} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="app-content">
      <header className="navbar">
        <button type="button" className="menu-button" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
        <h2>🔎 Deadline Detective</h2>
        <div className="navbar-actions">
  <button
    type="button"
    className="theme-toggle"
    onClick={() => setDarkMode(prev => !prev)}
    aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    aria-pressed={darkMode}
  >
    {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
  </button>

  <span>{user.name}</span>

  <button
    type="button"
    className="logout-button"
    onClick={onLogout}
  >
    Log out
  </button>
</div>
      </header>

      <main className="dashboard">
        <div className="page-header">
          <div>
            <p className="page-date">{todayLabel}</p>
            <h1>{view === 'dashboard' ? 'Dashboard' : view === 'planner' ? 'Study Planner' : view === 'settings' ? 'Settings' : viewTitles[view]}</h1>
          </div>
          <button type="button" onClick={openNewAssignment}>+ New Assignment</button>
        </div>

        {view === 'dashboard' && (<>
        <section className="summary-grid" aria-label="Assignment summary">
          <button type="button" className="summary-card is-soon" onClick={() => navigate('upcoming')}>
            <span>Due Soon</span><strong>{dueSoonCount}</strong>
          </button>
          <button type="button" className="summary-card is-overdue" onClick={() => navigate('pastdue')}>
            <span>Overdue</span><strong>{counts.pastdue}</strong>
          </button>
          <button type="button" className="summary-card is-pending" onClick={() => navigate('upcoming')}>
            <span>Pending</span><strong>{counts.upcoming}</strong>
          </button>
          <button type="button" className="summary-card is-done" onClick={() => navigate('completed')}>
            <span>Completed</span><strong>{counts.completed}</strong>
          </button>
        </section>
        
<section className="progress-card">
  <div className="progress-heading">
    <div>
      <p className="progress-eyebrow">YOUR STUDY PROGRESS</p>
      <h2>You're making progress!</h2>
      <p className="progress-description">
        Keep going, one assignment at a time.
      </p>
    </div>

    <div className="progress-percentage">
      {completionPercentage}%
    </div>
  </div>

  <div
    className="progress-track"
    role="progressbar"
    aria-label="Assignment completion progress"
    aria-valuenow={completionPercentage}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      className="progress-fill"
      style={{ width: `${completionPercentage}%` }}
    />
  </div>

  <div className="progress-footer">
    <span>
      {completed} of {assignments.length} assignments completed
    </span>
    <span>
      {remainingHours} study hours remaining
    </span>
  </div>
</section>

</>)}

{view === 'planner' && (
  <StudyPlanner
    assignments={assignments}
    availableHours={availableHours}
    onHoursChange={setAvailableHours}
    startTime={studyStartTime}
    onStartTimeChange={setStudyStartTime}
    generated={planGenerated}
    onGeneratedChange={setPlanGenerated}
    onMessage={setMessage}
  />
)}

        {view === 'dashboard' && (<>

        {assignments.some((assignment) => {
  if (Boolean(assignment.completed)) return false;

  const deadline = assignment.deadline;
  if (!deadline) return false;

  const today = new Date();
  const dueDate = new Date(`${deadline.slice(0, 10)}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  const daysLeft = Math.round(
    (dueDate - today) / (1000 * 60 * 60 * 24)
  );

  return daysLeft >= 0 && daysLeft <= 1;
}) && (
  <div className="deadline-warning" role="alert">
    <strong>🔔 Deadline Alert!</strong>
    <span> You have assignments due today or tomorrow. Check your deadlines!</span>
  </div>
)}
        {overdue > 0 && (
          <div className="deadline-warning" role="alert">
            <strong>⚠️ {overdue} overdue assignment{overdue === 1 ? '' : 's'}!</strong>
            <span> Review your pending work and make a catch-up plan.</span>
          </div>
        )}

        <section className="action-card">
          <div>
            <h2>🧭 Rescue Mode</h2>
            <p>Find which assignment to work on next.</p>
          </div>
          <button onClick={findNextTask}>Find My Next Task</button>
        </section>

        {!loading && assignments.length === 0 ? (
          <section className="assignments dash-panel">
            <p className="empty-state">
              No assignments yet. Add your first one to see deadlines and a study plan here.
            </p>
            <button type="button" onClick={openNewAssignment}>+ New Assignment</button>
          </section>
        ) : (
          <div className="dash-grid">
            <section className="assignments dash-panel">
              <div className="section-heading"><h2>Priority Assignments</h2></div>
              {priorityList.length === 0 ? <p className="empty-state">Nothing pending. You are all caught up.</p> : (
                <ul className="dash-list">
                  {priorityList.map(i => (
                    <li key={i.id}>
                      <div><strong>{i.title}</strong><p>{i.subject} · {i.priority} priority</p></div>
                      <span className={`deadline-status ${sectionOf(i) === 'pastDue' ? 'overdue' : 'upcoming'}`}>{timeRemaining(i, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="assignments dash-panel">
              <div className="section-heading">
                <h2>Upcoming Deadlines</h2>
                <button type="button" className="secondary-button" onClick={() => navigate('upcoming')}>View all</button>
              </div>
              {upcomingList.length === 0 ? <p className="empty-state">No upcoming deadlines.</p> : (
                <ul className="dash-list">
                  {upcomingList.map(i => (
                    <li key={i.id}>
                      <div><strong>{i.title}</strong><p>{i.subject}</p></div>
                      <span className="deadline-status upcoming">{i.deadline}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="assignments dash-panel dash-wide">
              <div className="section-heading">
                <h2>Today's Plan</h2>
                <button type="button" className="secondary-button" onClick={() => navigate('planner')}>Open planner</button>
              </div>
              {planSlots.length === 0 ? (
                <p className="empty-state">No plan generated yet. Open the planner to build today's schedule.</p>
              ) : (
                <ul className="dash-list">
                  {planSlots.map(slot => (
                    <li key={slot.id}>
                      <div><strong>{slot.title}</strong><p>{slot.subject}</p></div>
                      <span className="deadline-status upcoming">{slot.start} – {slot.end}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        </>)}

        {message && (
          <div className="notice" role="status">
            {message}
            <button
              className="close-button"
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {view === 'settings' && (
          <section className="assignments"><h2>My account</h2><p><strong>Name:</strong> {user.name}</p><p><strong>Email:</strong> {user.email}</p><p className="empty-state">Your assignments are private to your account.</p><button type="button" onClick={onLogout}>Log out</button></section>
        )}

        {!['dashboard', 'planner', 'settings'].includes(view) && (
        <section className="assignments">
          <div className="section-heading">
            <h2>{viewTitles[view]}</h2>
            <button
              onClick={() => {
                if (showForm) {
                  cancelForm()
                } else {
                  resetForm()
                  setShowForm(true)
                }
              }}
            >
              {showForm ? 'Cancel' : '+ Add Assignment'}
            </button>
          </div>

          {showForm && (
            <form
              ref={formRef}
              key={editingId ?? 'new'}
              className="assignment-form"
              onSubmit={saveAssignment}
            >
              <h3 className="form-title">
                {editingId !== null ? 'Edit Assignment' : 'New Assignment'}
              </h3>

              <label>
                Assignment Title
                <input
                  required
                  autoFocus
                  maxLength={100}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. MAD Assignment 1"
                />
              </label>

              <label>
                Subject
                <input
                  required
                  maxLength={60}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Mobile Application Development"
                />
              </label>

              <label>
                Deadline
                <input
                  required
                  type="date"
                  value={deadline}
                  min={editingId === null ? new Date().toLocaleDateString('en-CA') : undefined}
                  onChange={e => setDeadline(e.target.value)}
                />
              </label>

              <label>
                Estimated Hours
                <input
                  required
                  type="number"
                  min="0.5"
                  max="500"
                  step="0.5"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                />
              </label>

              <label>
                Priority
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Save Assignment'}
                </button>
                {editingId !== null && (
                  <button type="button" className="secondary-button" onClick={cancelForm} disabled={saving}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {!loading && assignments.length > 0 && (
            <div className="list-toolbar">
              <input
                type="search"
                className="toolbar-search"
                placeholder="Search title or subject"
                aria-label="Search assignments"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
              >
                <option value="All">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              {view === 'assignments' && (
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="All">All statuses</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="pastDue">Past due</option>
                  <option value="completed">Completed</option>
                </select>
              )}
              <select
                aria-label="Sort assignments"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="deadline-asc">Deadline: earliest first</option>
                <option value="deadline-desc">Deadline: latest first</option>
                <option value="priority">Priority: high first</option>
                <option value="title">Title: A to Z</option>
                <option value="hours-desc">Hours: most first</option>
              </select>
            </div>
          )}

          {filtersActive && (
            <div className="results-bar">
              <span>Showing {visibleAssignments.length} of {viewItems.length}</span>
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}

          {loading ? (
            <p>Loading assignments...</p>
          ) : assignments.length === 0 ? (
            <p className="empty-state">
              No assignments yet. Click “Add Assignment” to get started.
            </p>
          ) : visibleAssignments.length === 0 ? (
            <p className="empty-state">
              {filtersActive ? 'No assignments match your search or filters.' : 'Nothing here right now.'}
            </p>
          ) : (
            <div className="assignment-list">
              {visibleAssignments.map(item => {
                const status = getDeadlineStatus(
                  item.deadline,
                  Boolean(item.completed)
                )

                return (
                  <article
                    className={`assignment-item ${editingId === item.id ? 'is-editing' : ''}`}
                    key={item.id}
                  >
                    <div className="assignment-info">
                      <h3 className={item.completed ? 'is-complete' : ''}>
                        {item.title}
                      </h3>
                      <p>
                        {item.subject} · Due {item.deadline} · {item.hours} hours
                      </p>

                      <div className="assignment-badges">
                        <span className={`priority ${item.priority.toLowerCase()}`}>
                          {item.priority} Priority
                        </span>
                        <span className={`deadline-status ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="item-actions">
                      <button
                        className="secondary-button"
                        aria-label={`${item.completed ? 'Mark incomplete' : 'Mark complete'}: ${item.title}`}
                        onClick={() => toggleComplete(item)}
                      >
                        {item.completed ? 'Undo' : 'Complete'}
                      </button>
                      <button
                        className="secondary-button"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-button"
                        aria-label={`Delete ${item.title}`}
                        onClick={e => {
                          deleteTriggerRef.current = e.currentTarget
                          setDeleteTarget(item)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        )}
      </main>
      </div>

      {deleteTarget && (
        <div
          className="dialog-backdrop"
          onClick={() => { if (!deleting) setDeleteTarget(null) }}
        >
          <div
            className="dialog"
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-desc"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="delete-title">Delete this assignment?</h3>
            <p id="delete-desc">
              <strong>{deleteTarget.title}</strong> ({deleteTarget.subject}) will be
              permanently removed. This cannot be undone.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                autoFocus
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-solid"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    let active = true
    fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      .then(async r => r.ok ? (await r.json()).user : null)
      .then(u => { if (active) setUser(u) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setChecking(false) })
    const unauthorized = () => setUser(null)
    window.addEventListener('dd:unauthorized', unauthorized)
    return () => { active = false; window.removeEventListener('dd:unauthorized', unauthorized) }
  }, [])
  async function logout() {
    try { await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }) } catch {}
    setUser(null)
  }
  if (checking) return <main className="auth-page"><p>Loading your workspace…</p></main>
  return user ? <DashboardApp key={user.id} user={user} onLogout={logout} /> : <AuthScreen onLogin={setUser} />
}
