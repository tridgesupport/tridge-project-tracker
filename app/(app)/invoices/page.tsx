'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Client, Invoice } from '@/types'
import { getClients, updateClient, getInvoices, resendInvoice } from '@/lib/api'
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
import { Pencil, Eye, Send } from 'lucide-react'

type BillingForm = {
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

const emptyForm: BillingForm = {
  invoice_to_name: '', invoice_address: '', gstin: '', amount: '',
  description_label: 'AMC', invoice_to_email: '', invoice_cc_emails: '',
  client_number: '', auto_invoice_active: false,
}

export default function InvoicesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<(Invoice & { client_name: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<BillingForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const role = (session?.user as unknown as Record<string, string>)?.role

  useEffect(() => {
    if (!session) return
    if (role !== 'admin') { router.push('/projects'); return }
    load().then(() => setLoading(false))
  }, [session])

  async function load() {
    try {
      const [cls, invs] = await Promise.all([getClients(), getInvoices()])
      setClients(cls)
      setInvoices(invs)
    } catch {
      toast.error('Failed to load invoicing data')
    }
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
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
    if (!editing) return
    setSaving(true)
    try {
      await updateClient(editing.id, {
        invoice_to_name: form.invoice_to_name.trim() || null,
        invoice_address: form.invoice_address.trim() || null,
        gstin: form.gstin.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        description_label: form.description_label.trim() || 'AMC',
        invoice_to_email: form.invoice_to_email.trim() || null,
        invoice_cc_emails: form.invoice_cc_emails.trim() || null,
        client_number: form.client_number ? Number(form.client_number) : null,
        auto_invoice_active: form.auto_invoice_active,
      })
      toast.success('Billing profile saved')
      setModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  function previewPdf(clientId: string) {
    window.open(`/api/invoices/${clientId}/preview`, '_blank')
  }

  async function sendNow(client: Client) {
    if (!client.amount || !client.client_number) {
      toast.error('Set amount and client # before sending')
      return
    }
    setSendingId(client.id)
    try {
      const result = await resendInvoice(client.id)
      if (result.outcome === 'skipped') toast.info('Already invoiced for this period')
      else toast.success('Invoice sent')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSendingId(null)
    }
  }

  async function resendHistoryRow(inv: Invoice) {
    setSendingId(inv.id)
    try {
      await resendInvoice(inv.client_id, { periodMonth: inv.period_month, periodYear: inv.period_year })
      toast.success('Invoice resent')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSendingId(null)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Invoices</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Clients marked Active are billed automatically on the 30th of every month.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Client #</TableHead>
                <TableHead>Amount (INR)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Invoice Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">No clients yet — add one on the Clients tab first.</TableCell></TableRow>
              ) : clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.client_number ?? '—'}</TableCell>
                  <TableCell>{c.amount != null ? Number(c.amount).toFixed(2) : '—'}</TableCell>
                  <TableCell>{c.description_label}</TableCell>
                  <TableCell>{c.invoice_to_email || c.email || '—'}</TableCell>
                  <TableCell>
                    <Badge className={c.auto_invoice_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                      {c.auto_invoice_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit billing profile">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => previewPdf(c.id)} title="Preview PDF">
                        <Eye size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => sendNow(c)}
                        disabled={sendingId === c.id} title="Send this month's invoice now">
                        <Send size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Sent Invoices</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">No invoices sent yet.</TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell>{inv.period_month}/{inv.period_year}</TableCell>
                  <TableCell>{Number(inv.amount).toFixed(2)}</TableCell>
                  <TableCell>{inv.sent_at ? new Date(inv.sent_at).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <Badge className={inv.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {inv.status}
                    </Badge>
                    {inv.status === 'failed' && inv.error_message && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-xs">{inv.error_message}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => resendHistoryRow(inv)}
                      disabled={sendingId === inv.id} title="Resend this invoice">
                      <Send size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={v => !v && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Billing Profile — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <Label>Bill-to Name</Label>
              <Input value={form.invoice_to_name}
                onChange={e => setForm(f => ({ ...f, invoice_to_name: e.target.value }))} />
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
                Printed as “{form.description_label || 'AMC'} for {'{'}Month{'}'} {'{'}Year{'}'}”
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Invoice-to Email</Label>
              <Input type="email" value={form.invoice_to_email}
                onChange={e => setForm(f => ({ ...f, invoice_to_email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>CC Emails</Label>
              <Input value={form.invoice_cc_emails} placeholder="comma-separated"
                onChange={e => setForm(f => ({ ...f, invoice_cc_emails: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="active" checked={form.auto_invoice_active}
                onChange={e => setForm(f => ({ ...f, auto_invoice_active: e.target.checked }))} />
              <Label htmlFor="active">Auto-invoice this client monthly</Label>
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
