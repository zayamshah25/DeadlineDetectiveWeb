const path = require('path')
const crypto = require('crypto')
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')

const app = express()
const PORT = Number(process.env.PORT || 3000)
const ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',')
const secureCookie = process.env.NODE_ENV === 'production'
app.disable('x-powered-by')
app.use(cors({ origin(origin, cb) { cb(null, !origin || ORIGINS.includes(origin)) }, credentials: true }))
app.use(express.json({ limit: '16kb' }))
// All state-changing browser requests must come from the configured frontend.
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !ORIGINS.includes(req.headers.origin)) return res.status(403).json({ error: 'Origin not allowed.' })
  next()
})

const db = new Database(path.join(__dirname, 'deadline_detective.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL, subject TEXT NOT NULL, deadline TEXT NOT NULL,
 hours REAL NOT NULL, priority TEXT NOT NULL DEFAULT 'Medium', completed INTEGER NOT NULL DEFAULT 0
);
`)
const cols = db.prepare('PRAGMA table_info(assignments)').all()
if (!cols.some(c => c.name === 'completed_at')) db.exec('ALTER TABLE assignments ADD COLUMN completed_at TEXT')
// Legacy assignments intentionally remain unowned and invisible until explicitly migrated.
if (!cols.some(c => c.name === 'user_id')) db.exec('ALTER TABLE assignments ADD COLUMN user_id INTEGER REFERENCES users(id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_user_deadline ON assignments(user_id, deadline)')

const hash = s => crypto.createHash('sha256').update(s).digest('hex')
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
}
function verifyPassword(password, stored) {
  const [salt, digest] = String(stored).split(':')
  if (!salt || !digest || !/^[a-f0-9]{128}$/.test(digest)) return false
  const expected = Buffer.from(digest, 'hex')
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), expected)
}
function cookie(req) {
  const pair = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('dd_session='))
  return pair ? decodeURIComponent(pair.slice('dd_session='.length)) : null
}
function setCookie(res, token, maxAge) {
  res.cookie('dd_session', token, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', maxAge })
}
function auth(req, res, next) {
  const token = cookie(req)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please log in.' })
  const row = db.prepare('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(hash(token), Date.now())
  if (!row) return res.status(401).json({ error: 'Session expired. Please log in again.' })
  req.user = row
  next()
}
function createSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex')
  const age = 7 * 24 * 60 * 60 * 1000
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), user.id, Date.now() + age)
  setCookie(res, token, age)
  res.json({ user: { id: user.id, name: user.name, email: user.email } })
}
const attempts = new Map()
function throttle(req, res, next) {
  const key = req.ip || 'unknown', now = Date.now()
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
  if (now > entry.until) { entry.count = 0; entry.until = now + 15 * 60000 }
  entry.count++
  attempts.set(key, entry)
  if (entry.count > 25) return res.status(429).json({ error: 'Too many attempts. Try again later.' })
  next()
}
app.post('/api/auth/register', throttle, (req, res) => {
  const { name, email, password } = req.body || {}
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) return res.status(400).json({ error: 'Name must be 1–80 characters.' })
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' })
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters.' })
  const normalized = email.trim().toLowerCase()
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) return res.status(409).json({ error: 'Email already registered.' })
  const result = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim(), normalized, passwordHash(password))
  createSession(res, { id: Number(result.lastInsertRowid), name: name.trim(), email: normalized })
})
app.post('/api/auth/login', throttle, (req, res) => {
  const { email, password } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Enter email and password.' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' })
  createSession(res, user)
})
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }))
app.post('/api/auth/logout', (req, res) => {
  const token = cookie(req)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
  setCookie(res, '', 0)
  res.json({ message: 'Logged out.' })
})
app.get('/', (req, res) => res.json({ message: 'Deadline Detective API running.' }))
function realDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
function validate(b) {
  if (typeof b?.title !== 'string' || !b.title.trim() || b.title.trim().length > 100) return 'Title must be 1–100 characters.'
  if (typeof b.subject !== 'string' || !b.subject.trim() || b.subject.trim().length > 60) return 'Subject must be 1–60 characters.'
  if (!realDate(b.deadline)) return 'Enter a valid deadline.'
  if (typeof b.hours !== 'number' || !Number.isFinite(b.hours) || b.hours <= 0 || b.hours > 500) return 'Hours must be between 0 and 500.'
  if (!['Low', 'Medium', 'High'].includes(b.priority)) return 'Invalid priority.'
  return null
}
function idFrom(req, res) {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: 'Invalid assignment ID.' }); return null }
  return id
}
const getOwn = (id, uid) => db.prepare('SELECT * FROM assignments WHERE id = ? AND user_id = ?').get(id, uid)
app.get('/api/assignments', auth, (req, res) => res.json(db.prepare('SELECT * FROM assignments WHERE user_id = ? ORDER BY deadline, id').all(req.user.id)))
app.post('/api/assignments', auth, (req, res) => {
  const error = validate(req.body)
  if (error) return res.status(400).json({ error })
  const { title, subject, deadline, hours, priority } = req.body
  const result = db.prepare('INSERT INTO assignments(title,subject,deadline,hours,priority,user_id) VALUES(?,?,?,?,?,?)').run(title.trim(), subject.trim(), deadline, hours, priority, req.user.id)
  res.status(201).json(getOwn(result.lastInsertRowid, req.user.id))
})
app.put('/api/assignments/:id', auth, (req, res) => {
  const id = idFrom(req, res); if (id === null) return
  const error = validate(req.body); if (error) return res.status(400).json({ error })
  const { title, subject, deadline, hours, priority } = req.body
  const result = db.prepare('UPDATE assignments SET title=?,subject=?,deadline=?,hours=?,priority=? WHERE id=? AND user_id=?').run(title.trim(),subject.trim(),deadline,hours,priority,id,req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Assignment not found.' })
  res.json(getOwn(id, req.user.id))
})
app.patch('/api/assignments/:id/complete', auth, (req, res) => {
  const id = idFrom(req, res); if (id === null) return
  if (typeof req.body?.completed !== 'boolean') return res.status(400).json({ error: 'Completed must be true or false.' })
  const done = req.body.completed
  const result = db.prepare('UPDATE assignments SET completed=?, completed_at=? WHERE id=? AND user_id=?').run(done ? 1 : 0, done ? new Date().toISOString() : null, id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Assignment not found.' })
  res.json(getOwn(id, req.user.id))
})
app.delete('/api/assignments/:id', auth, (req, res) => {
  const id = idFrom(req, res); if (id === null) return
  const result = db.prepare('DELETE FROM assignments WHERE id=? AND user_id=?').run(id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Assignment not found.' })
  res.json({ message: 'Assignment deleted.' })
})
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }))
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' })
  console.error(err)
  res.status(500).json({ error: 'Server error.' })
})
app.listen(PORT, () => console.log(`Deadline Detective API at http://localhost:${PORT}`))
