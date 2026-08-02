'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Client } from '@/types'
import { getClients, createClient, updateClient, deleteClient, resendInvoice } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Send, Eye } from 'lucide-react'

type ClientForm = {
  name: string
  contact: string
  email: string
  invoice_to_name: string
  invoice_address: string
  gstin: string
  amount: string
  description_label: string
  invoice_to_email: string
  invoice_cc_emails: string
  client_number: string
  auto_invoice_active: boolean
}

const emptyForm: ClientForm = {
  name: '', contact: '', email: '',
  invoice_to_name: '', invoice_address: '', gstin: '', amount: '',
  description_label: 'AMC', invoice_to_email: '', invoice_cc_emails: '',
  client_number: '', auto_invoice_active: false,
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
      amount: c.amount != null ? String(c.amount) : '',
      description_label: c.description_label || 'AMC',
      invoice_to_email: c.invoice_to_email || c.email || '',
      invoice_cc_emails: c.invoice_cc_emails || '',
      client_number: c.client_number != null ? String(c.client_number) : '',
      auto_invoice_active: c.auto_invoice_active,
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
      amount: form.amount ? Number(form.amount) : null,
      description_label: form.description_label.trim() || 'AMC',
      invoice_to_email: form.invoice_to_email.trim() || null,
      invoice_cc_emails: form.invoice_cc_emails.trim() || null,
      client_number: form.client_number ? Number(form.client_number) : null,
      auto_invoice_active: form.auto_invoice_active,
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

  async function toggleActive(c: Client) {
    setBusyId(c.id)
    try {
      // The backend PUT overwrites every billing field with what's sent (so the
      // full Edit dialog can clear fields) -- a partial payload here would
      // silently wipe the rest of the client's billing profile.
      await updateClient(c.id, {
        name: c.name, contact: c.contact, email: c.email,
        invoice_to_name: c.invoice_to_name, invoice_address: c.invoice_address,
        gstin: c.gstin, amount: c.amount, description_label: c.description_label,
        invoice_to_email: c.invoice_to_email, invoice_cc_emails: c.invoice_cc_emails,
        client_number: c.client_number, auto_invoice_active: !c.auto_invoice_active,
      })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

  function previewPdf(clientId: string) {
    window.open(`/api/invoices/client/${clientId}/preview`, '_blank')
  }

  async function sendNow(c: Client) {
    if (!c.amount || !c.client_number) {
      toast.error('Set amount and client # before sending')
      return
    }
    setBusyId(c.id)
    try {
      const result = await resendInvoice(c.id)
      if (result.outcome === 'skipped') toast.info('Already invoiced for this period')
      else toast.success('Invoice sent')
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
                <TableHead>Amount (INR)</TableHead>
                <TableHead>Billing Status</TableHead>
                {isAdmin && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.contact || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>{c.amount != null ? Number(c.amount).toFixed(2) : '—'}</TableCell>
                  <TableCell>
                    <Badge
                      onClick={() => isAdmin && toggleActive(c)}
                      className={`${isAdmin ? 'cursor-pointer' : ''} ${c.auto_invoice_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                      title={isAdmin ? 'Click to toggle' : undefined}
                    >
                      {c.auto_invoice_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit client">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => previewPdf(c.id)} title="Preview invoice PDF">
                          <Eye size={14} />
                        </Button>
                        {c.auto_invoice_active && (
                          <Button variant="ghost" size="icon" onClick={() => sendNow(c)}
                            disabled={busyId === c.id} title="Send this month's recurring invoice now">
                            <Send size={14} />
                          </Button>
                        )}
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
            <div className="flex flex-col gap-1.5">
              <Label>GST Number</Label>
              <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Amount (INR)</Label>
                <Input type="number" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Client #</Label>
                <Input type="number" value={form.client_number}
                  onChange={e => setForm(f => ({ ...f, client_number: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description Label</Label>
              <Input value={form.description_label}
                onChange={e => setForm(f => ({ ...f, description_label: e.target.value }))} />
              <span className="text-xs text-muted-foreground">
                Recurring invoices are printed as “{form.description_label || 'AMC'} for {'{'}Month{'}'} {'{'}Year{'}'}”
              </span>
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
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="active" checked={form.auto_invoice_active}
                onChange={e => setForm(f => ({ ...f, auto_invoice_active: e.target.checked }))} />
              <Label htmlFor="active">Auto-invoice this client monthly (30th)</Label>
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
