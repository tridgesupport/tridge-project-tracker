'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)

    const res = await fetch('/api/invite-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Failed to accept invite')
      setLoading(false)
      return
    }

    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setDone(true)
    } else {
      router.push('/projects')
      router.refresh()
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="w-full max-w-sm bg-background rounded-xl border p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Account Created</h1>
          <p className="text-sm text-muted-foreground mb-4">Your account has been set up. Please sign in.</p>
          <Button onClick={() => router.push('/login')}>Sign In</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm bg-background rounded-xl border p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Tridge Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your account</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" type="text" placeholder="Jane Smith"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@tridge.co.in"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Setting up…' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
