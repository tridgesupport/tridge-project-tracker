'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Pencil, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLES: UserRole[] = ['admin', 'internal', 'client']
const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  internal: 'bg-blue-100 text-blue-700',
  client: 'bg-green-100 text-green-700',
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'internal' as UserRole })
  const [editForm, setEditForm] = useState({ name: '', role: 'internal' as UserRole })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/projects'); return }
      setProfile(prof)
      await loadUsers()
      setLoading(false)
    }
    load()
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('name')
    setUsers(data || [])
  }

  async function handleInvite() {
    if (!inviteForm.email.trim()) { toast.error('Email required'); return }
    setSaving(true)

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error('Could not send invite: ' + json.error)
    } else {
      toast.success('Invite sent to ' + inviteForm.email)
      setInviteOpen(false)
      await loadUsers()
    }
    setSaving(false)
  }

  async function handleEditUser() {
    if (!editingUser) return
    setSaving(true)
    const { error } = await supabase.from('users').update({
      name: editForm.name,
      role: editForm.role,
      team: editForm.role === 'client' ? 'client' : 'internal',
    }).eq('id', editingUser.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('User updated')
    setSaving(false)
    setEditOpen(false)
    await loadUsers()
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Admin — User Management</h1>
        <Button onClick={() => { setInviteForm({ email: '', name: '', role: 'internal' }); setInviteOpen(true) }}>
          <UserPlus size={16} className="mr-1" /> Invite User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name || '—'}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge className={cn('text-xs capitalize', roleColors[u.role] || '')}>{u.role}</Badge>
                </TableCell>
                <TableCell className="text-sm capitalize">{u.team}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditingUser(u)
                    setEditForm({ name: u.name, role: u.role })
                    setEditOpen(true)
                  }}>
                    <Pencil size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={v => !v && setInviteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving}>{saving ? 'Sending…' : 'Send Invite'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
