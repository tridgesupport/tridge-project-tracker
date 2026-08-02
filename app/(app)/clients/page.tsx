'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Client } from '@/types'
import { getClients, createClient, updateClient, deleteClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'

type ClientForm = {
  name: string
  contact: string
  email: string
  invoice_to_name: string
  invoice_address: string
  gstin: string
  invoice_to_email: string
  invoice_cc_emails: string
  client_number: string
}

const emptyForm: ClientForm = {
  name: '', contact: '', email: '',
  invoice_to_name: '', invoice_address: '', gstin: '',
  invoice_to_email: '', invoice_cc_emails: '', client_number: '',
}

export default function ClientsPage() {
  const { data: session } = useSession()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const role = (session?.user as unknown as Record<string, string>)?.role
  const isAdmin = role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const cls = await getClients()
      setClients(cls)
    } catch {
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      name: c.name, contact: c.contact || '', email: c.email || '',
      invoice_to_name: c.invoice_to_name || c.name,
      invoice_address: c.invoice_address || '',
      gstin: c.gstin || '',
      invoice_to_email: c.invoice_to_email || c.email || '',
      invoice_cc_emails: c.invoice_cc_emails || '',
      client_number: c.client_number != null ? String(c.client_number) : '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const data = {
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      email: form.email.trim() || null,
      invoice_to_name: form.invoice_to_name.trim() || null,
      invoice_address: form.invoice_address.trim() || null,
      gstin: form.gstin.trim() || null,
      invoice_to_email: form.invoice_to_email.trim() || null,
      invoice_cc_emails: form.invoice_cc_emails.trim() || null,
      client_number: form.client_number ? Number(form.client_number) : null,
      // Amount/description/recurring status are managed from the Invoices tab
      // now, but the PUT route overwrites whatever isn't sent -- carry the
      // existing values through untouched rather than wiping them.
      amount: editing?.amount ?? null,
      description_label: editing?.description_label ?? 'AMC',
      auto_invoice_active: editing?.auto_invoice_active ?? false,
    }
    try {
      if (editing) {
        await updateClient(editing.id, data)
        toast.success('Client updated')
      } else {
        await createClient(data)
        toast.success('Client added')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Delete client "${c.name}"? This cannot be undone.`)) return
    setBusyId(c.id)
    try {
      await deleteClient(c.id)
      toast.success('Client deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

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
                <TableHead>Client #</TableHead>
                {isAdmin && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.contact || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>{c.client_number ?? '—'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit client">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}
                          disabled={busyId === c.id} title="Delete client">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={v => !v && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
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

            <div className="mt-2 pt-3 border-t">
              <div className="text-sm font-medium mb-3">Billing Details</div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Bill-to Name</Label>
              <Input value={form.invoice_to_name}
                onChange={e => setForm(f => ({ ...f, invoice_to_name: e.target.value }))}
                placeholder="Defaults to client name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Bill-to Address</Label>
              <Textarea rows={4} value={form.invoice_address}
                onChange={e => setForm(f => ({ ...f, invoice_address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>GST Number</Label>
                <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Client #</Label>
                <Input type="number" value={form.client_number}
                  onChange={e => setForm(f => ({ ...f, client_number: e.target.value }))} />
                <span className="text-xs text-muted-foreground">Used in invoice numbering</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Invoice-to Email</Label>
              <Input type="email" value={form.invoice_to_email}
                onChange={e => setForm(f => ({ ...f, invoice_to_email: e.target.value }))}
                placeholder="Defaults to Email above" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>CC Emails</Label>
              <Input value={form.invoice_cc_emails} placeholder="comma-separated"
                onChange={e => setForm(f => ({ ...f, invoice_cc_emails: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Amount, description, and recurring billing are set from the Invoices tab when you create an invoice for this client.
            </p>
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
