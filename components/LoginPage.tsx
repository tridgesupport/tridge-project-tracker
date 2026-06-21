'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { credentialsSignIn } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type Mode = 'login' | 'signup' | 'forgot'

const subtitles: Record<Mode, string> = {
  login: 'Sign in to your account',
  signup: 'Create a new account',
  forgot: 'Reset your password',
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  function switchTo(next: Mode) {
    setMode(next)
    setPassword('')
    setConfirm('')
    setResetSent(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await credentialsSignIn(email, password)
      if (result.ok) {
        router.push('/projects')
        router.refresh()
      } else {
        toast.error('Invalid email or password')
      }
    } catch (err: any) {
      console.error('Sign-in exception:', err)
      toast.error('Sign-in error: ' + (err?.message || 'Unknown error'))
    }
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Registration failed')
      setLoading(false)
      return
    }

    const result = await credentialsSignIn(email, password)
    if (result.ok) {
      router.push('/projects')
      router.refresh()
    } else {
      toast.success('Account created! Please sign in.')
      switchTo('login')
    }
    setLoading(false)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm bg-background rounded-xl border p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Tridge Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitles[mode]}</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" placeholder="you@tridge.co.in"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button" onClick={() => switchTo('forgot')}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchTo('signup')}
                className="text-foreground underline-offset-2 hover:underline">
                Create one
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name" type="text" placeholder="Jane Smith"
                value={name} onChange={e => setName(e.target.value)} required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email" type="email" placeholder="you@tridge.co.in"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-confirm">Confirm Password</Label>
              <Input
                id="signup-confirm" type="password" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <button type="button" onClick={() => switchTo('login')}
                className="text-foreground underline-offset-2 hover:underline">
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && !resetSent && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email" type="email" placeholder="you@tridge.co.in"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
            <button type="button" onClick={() => switchTo('login')}
              className="text-xs text-center text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'forgot' && resetSent && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we sent a password reset link.
            </p>
            <Button variant="outline" onClick={() => switchTo('login')}>Back to sign in</Button>
          </div>
        )}
      </div>
    </div>
  )
}
