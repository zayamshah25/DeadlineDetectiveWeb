import { useState } from 'react'
import './AuthScreen.css'
const BASE = 'http://localhost:3000'
export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const response = await fetch(`${BASE}/api/auth/${mode}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not continue.')
      onLogin(data.user)
    } catch (e) { setError(e.message === 'Failed to fetch' ? 'Backend server start karein (port 3000).' : e.message) }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><div className="auth-card">
    <div className="auth-mark">🔎</div><h1>Deadline Detective</h1>
    <p className="auth-intro">Your assignments, deadlines and study plan — all in one place.</p>
    <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError('') }}>Log in</button><button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError('') }}>Create account</button></div>
    <form onSubmit={submit} className="auth-form">
      {mode === 'register' && <label>Full name<input required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>}
      <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input required type={showPassword ? 'text' : 'password'} minLength={mode === 'register' ? 8 : undefined} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} /></label>
      <label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} /> Show password</label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create my account'}</button>
    </form><p className="auth-foot">Each student gets a private workspace.</p>
  </div></main>
}
