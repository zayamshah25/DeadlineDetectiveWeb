const ITEMS = [
  ['dashboard', 'Dashboard'],
  ['assignments', 'My Assignments'],
  ['upcoming', 'Upcoming / Pending'],
  ['pastdue', 'Past Due'],
  ['completed', 'Completed'],
  ['planner', 'Study Planner'],
  ['settings', 'Settings'],
]

export default function Sidebar({ view, onNavigate, counts, open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">Deadline Detective</div>
        <nav aria-label="Main navigation">
          {ITEMS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${view === key ? 'is-active' : ''}`}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => onNavigate(key)}
            >
              <span>{label}</span>
              {counts[key] > 0 && (
                <span className={`nav-count ${key === 'pastdue' ? 'is-danger' : ''}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
