'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/projects')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/confirm?next=/auth/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      toast.error(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  function switchToForgot() {
    setMode('forgot')
    setResetSent(false)
    setPassword('')
  }

  function switchToLogin() {
    setMode('login')
    setResetSent(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm bg-background rounded-xl border p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Tridge Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@tridge.co.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        ) : resetSent ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Check your inbox — we sent a password reset link to <strong>{email}</strong>.
            </p>
            <Button variant="outline" onClick={switchToLogin}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@tridge.co.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
            <button
              type="button"
              onClick={switchToLogin}
              className="text-xs text-center text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
