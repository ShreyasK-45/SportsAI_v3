import { useState } from 'react'
import { Activity, X, Loader2 } from 'lucide-react'
import { auth } from '../lib/supabaseApi'
import { isConfigured } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export function AuthModal({ onClose, onAuth }: { onClose: () => void; onAuth: (user: any) => void }) {
  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  if (!isConfigured) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <button className="auth-close" onClick={onClose}><X size={18} /></button>
          <div className="auth-brand"><Activity size={22} /><span>SportsAI+</span></div>
          <h2>Supabase not configured</h2>
          <p className="auth-sub">
            To enable cloud sync, copy <code>.env.example</code> to <code>.env.local</code> and fill in your
            Supabase project URL and anon key. Then restart the dev server.
          </p>
          <p className="auth-sub">
            Run the SQL in <code>supabase_schema.sql</code> in your Supabase SQL editor first.
          </p>
          <button className="auth-btn" onClick={onClose}>Continue offline</button>
        </div>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = mode === 'signup'
        ? await auth.signUp(email, password, name)
        : await auth.signIn(email, password)
      onAuth(user)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <button className="auth-close" onClick={onClose}><X size={18} /></button>
        <div className="auth-brand"><Activity size={22} /><span>SportsAI+</span></div>
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Sign in to sync your analyses and profile across devices.'
            : 'Save your analyses and nutrition plans to the cloud.'}
        </p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Name
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
