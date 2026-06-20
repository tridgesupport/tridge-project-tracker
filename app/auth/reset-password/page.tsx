'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-destructive">Invalid or missing reset token.</p>
        <button onClick={() => router.push('/login')}
          className="text-sm underline mt-2">Back to sign in</button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, token }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'Failed to reset password')
    } else {
      toast.success('Password updated — please sign in')
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New Password</Label>
        <Input id="password" type="password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirm Password</Label>
        <Input id="confirm" type="password" placeholder="••••••••"
          value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm bg-background rounded-xl border p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Tridge Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a new password</p>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
