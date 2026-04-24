'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Client, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', contact: '', email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prof }, { data: cls }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('clients').select('*').order('name'),
    ])
    setProfile(prof)
    setClients(cls || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', contact: '', email: '' })
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, contact: c.contact || '', email: c.email || '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('clients').update(form).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Client updated')
    } else {
      const { error } = await supabase.from('clients').insert(form)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Client added')
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Clients</h1>
        {isAdmin && (
          <Button onClick={openAdd}><Plus size={16} className="mr-1" />Add Client</Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="text-sm text-muted-foreground">No clients found.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.contact || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={v => !v && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
