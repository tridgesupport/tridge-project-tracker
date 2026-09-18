'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Client, Invoice } from '@/types'
import {
  getClients, getInvoices, createInvoice, sendInvoiceNow, cancelInvoice, updateClient, resendInvoice,
  updateInvoicePaymentStatus,
} from '@/lib/api'
import { monthLabel } from '@/lib/invoice-number'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/DatePicker'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Eye, Send, X, Pencil, Pause, Play } from 'lucide-react'

type InvoiceWithClient = Invoice & { client_name: string }
type InvoiceType = 'onetime' | 'recurring'

const statusStyles: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const PAYMENT_STATUSES = ['unpaid', 'paid', 'overdue'] as const

const paymentStatusStyles: Record<string, string> = {
  unpaid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

function currentMonthLabel() {
  const now = new Date()
  return monthLabel(now.getMonth() + 1, now.getFullYear())
}

// updateClient overwrites every billing field with whatever is sent (so the
// full client edit form can clear fields) -- any partial-update call site
// must build its payload from the complete current client record like this,
// or it will silently wipe the rest of the client's billing profile.
function fullClientPayload(c: Client, overrides: Record<string, unknown> = {}) {
  return {
    name: c.name, contact: c.contact, email: c.email,
    invoice_to_name: c.invoice_to_name, invoice_address: c.invoice_address,
    gstin: c.gstin, invoice_to_email: c.invoice_to_email,
    invoice_cc_emails: c.invoice_cc_emails, client_number: c.client_number,
    amount: c.amount, description_label: c.description_label,
    auto_invoice_active: c.auto_invoice_active,
    ...overrides,
  }
}

export default function InvoicesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Create Invoice dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('onetime')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [sendNowRecurring, setSendNowRecurring] = useState(true)
  const [creating, setCreating] = useState(false)

  // Recurring Billing quick-edit dialog
  const [recurringEditOpen, setRecurringEditOpen] = useState(false)
  const [recurringEditClient, setRecurringEditClient] = useState<Client | null>(null)
  const [recurringEditAmount, setRecurringEditAmount] = useState('')
  const [recurringEditDescLabel, setRecurringEditDescLabel] = useState('')
  const [recurringSaving, setRecurringSaving] = useState(false)

  const role = (session?.user as unknown as Record<string, string>)?.role
  const selectedClient = clients.find(c => c.id === clientId) || null
  const recurringClients = clients.filter(c => c.amount != null)

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

  function applyPrefill(client: Client | null, type: InvoiceType) {
    if (!client || type === 'onetime') {
      setDescription('')
      setAmount('')
      return
    }
    setDescription(client.description_label || 'AMC')
    setAmount(client.amount != null ? String(client.amount) : '')
  }

  function openCreate() {
    setClientId('')
    setInvoiceType('onetime')
    setDescription('')
    setAmount('')
    setSendMode('now')
    setScheduledDate(null)
    setSendNowRecurring(true)
    setCreateOpen(true)
  }

  function handleClientChange(id: string | null) {
    setClientId(id || '')
    applyPrefill(clients.find(x => x.id === id) || null, invoiceType)
  }

  function handleTypeChange(type: InvoiceType) {
    setInvoiceType(type)
    applyPrefill(selectedClient, type)
  }

  function previewDraft() {
    if (!clientId) return
    const finalDescription = invoiceType === 'recurring'
      ? `${description || 'AMC'} for ${currentMonthLabel()}`
      : description
    const params = new URLSearchParams({ amount: amount || '0', description: finalDescription || '' })
    window.open(`/api/invoices/client/${clientId}/preview?${params.toString()}`, '_blank')
  }

  async function handleCreate() {
    if (!clientId) { toast.error('Pick a client'); return }
    if (!description.trim()) { toast.error(invoiceType === 'recurring' ? 'Description label is required' : 'Description is required'); return }
    if (!amount || Number(amount) <= 0) { toast.error('Amount is required'); return }
    const client = clients.find(c => c.id === clientId)
    if (!client) { toast.error('Client not found'); return }

    setCreating(true)
    try {
      if (invoiceType === 'recurring') {
        await updateClient(clientId, fullClientPayload(client, {
          amount: Number(amount), description_label: description.trim(), auto_invoice_active: true,
        }))
        if (sendNowRecurring) {
          const result = await resendInvoice(clientId)
          toast.success(result.outcome === 'skipped'
            ? 'Recurring billing activated (already invoiced this period)'
            : 'Recurring billing activated and this month sent')
        } else {
          toast.success('Recurring billing activated')
        }
      } else {
        if (sendMode === 'schedule' && !scheduledDate) { toast.error('Pick a date to schedule for'); return }
        await createInvoice({
          clientId, description: description.trim(), amount: Number(amount),
          sendNow: sendMode === 'now',
          scheduledDate: sendMode === 'schedule' ? scheduledDate! : undefined,
        })
        toast.success(sendMode === 'now' ? 'Invoice sent' : 'Invoice scheduled')
      }
      setCreateOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleSendNow(inv: InvoiceWithClient) {
    setBusyId(inv.id)
    try {
      await sendInvoiceNow(inv.id)
      toast.success('Invoice sent')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(inv: InvoiceWithClient) {
    if (!confirm(`Cancel scheduled invoice ${inv.invoice_number}?`)) return
    setBusyId(inv.id)
    try {
      await cancelInvoice(inv.id)
      toast.success('Invoice cancelled')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

  function previewInvoice(inv: InvoiceWithClient) {
    window.open(`/api/invoices/${inv.id}/preview`, '_blank')
  }

  async function handlePaymentStatusChange(inv: InvoiceWithClient, status: string) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, payment_status: status as Invoice['payment_status'] } : i))
    try {
      await updateInvoicePaymentStatus(inv.id, status)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payment status')
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, payment_status: inv.payment_status } : i))
    }
  }

  function previewRecurring(c: Client) {
    window.open(`/api/invoices/client/${c.id}/preview`, '_blank')
  }

  async function toggleRecurringActive(c: Client) {
    setBusyId(c.id)
    try {
      await updateClient(c.id, fullClientPayload(c, { auto_invoice_active: !c.auto_invoice_active }))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

  async function sendRecurringNow(c: Client) {
    setBusyId(c.id)
    try {
      const result = await resendInvoice(c.id)
      toast.success(result.outcome === 'skipped' ? 'Already invoiced for this period' : 'Invoice sent')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusyId(null)
    }
  }

  function openRecurringEdit(c: Client) {
    setRecurringEditClient(c)
    setRecurringEditAmount(c.amount != null ? String(c.amount) : '')
    setRecurringEditDescLabel(c.description_label || 'AMC')
    setRecurringEditOpen(true)
  }

  async function saveRecurringEdit() {
    if (!recurringEditClient) return
    if (!recurringEditAmount || Number(recurringEditAmount) <= 0) { toast.error('Amount is required'); return }
    setRecurringSaving(true)
    try {
      await updateClient(recurringEditClient.id, fullClientPayload(recurringEditClient, {
        amount: Number(recurringEditAmount), description_label: recurringEditDescLabel.trim() || 'AMC',
      }))
      toast.success('Recurring billing updated')
      setRecurringEditOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setRecurringSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold">Invoices</h1>
          <Button onClick={openCreate}><Plus size={16} className="mr-1" />Create Invoice</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a one-time invoice, or set up recurring monthly billing for a client — sent automatically on the 30th.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recurring Billing</h2>
        {recurringClients.length === 0 ? (
          <div className="text-sm text-muted-foreground">No clients on recurring billing yet — use Create Invoice to set one up.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount (INR)</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringClients.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{Number(c.amount).toFixed(2)}</TableCell>
                    <TableCell>{c.description_label}</TableCell>
                    <TableCell>
                      <Badge className={c.auto_invoice_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                        {c.auto_invoice_active ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleRecurringActive(c)}
                          disabled={busyId === c.id}
                          title={c.auto_invoice_active ? 'Pause recurring billing' : 'Restart recurring billing'}>
                          {c.auto_invoice_active ? <Pause size={14} /> : <Play size={14} />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openRecurringEdit(c)} title="Edit amount/description">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => previewRecurring(c)} title="Preview PDF">
                          <Eye size={14} />
                        </Button>
                        {c.auto_invoice_active && (
                          <Button variant="ghost" size="icon" onClick={() => sendRecurringNow(c)}
                            disabled={busyId === c.id} title="Send this month now">
                            <Send size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Invoice History</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">No invoices yet.</TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell className="max-w-xs truncate">{inv.description}</TableCell>
                  <TableCell>{Number(inv.amount).toFixed(2)}</TableCell>
                  <TableCell>{new Date(inv.scheduled_date || inv.invoice_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={statusStyles[inv.status] || ''}>{inv.status}</Badge>
                    {inv.status === 'failed' && inv.error_message && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-xs">{inv.error_message}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={inv.payment_status || 'unpaid'}
                      onValueChange={(v: string | null) => v && handlePaymentStatusChange(inv, v)}>
                      <SelectTrigger className={`h-7 text-xs w-28 capitalize ${paymentStatusStyles[inv.payment_status] || ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => previewInvoice(inv)} title="Preview PDF">
                        <Eye size={14} />
                      </Button>
                      {(inv.status === 'scheduled' || inv.status === 'failed') && (
                        <Button variant="ghost" size="icon" onClick={() => handleSendNow(inv)}
                          disabled={busyId === inv.id} title="Send now">
                          <Send size={14} />
                        </Button>
                      )}
                      {inv.status === 'scheduled' && (
                        <Button variant="ghost" size="icon" onClick={() => handleCancel(inv)}
                          disabled={busyId === inv.id} title="Cancel">
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={invoiceType === 'onetime'} onChange={() => handleTypeChange('onetime')} />
                One-time
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" checked={invoiceType === 'recurring'} onChange={() => handleTypeChange('recurring')} />
                Recurring (monthly, 30th)
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client">
                    {(value: string | null) => clients.find(c => c.id === value)?.name || 'Select a client'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">{selectedClient.invoice_to_name || selectedClient.name}</div>
                {selectedClient.invoice_address && (
                  <div className="text-muted-foreground whitespace-pre-line">{selectedClient.invoice_address}</div>
                )}
                {selectedClient.gstin && <div className="text-muted-foreground">GST: {selectedClient.gstin}</div>}
                <div className="text-muted-foreground">
                  To: {selectedClient.invoice_to_email || selectedClient.email || '—'}
                  {selectedClient.invoice_cc_emails ? ` (cc: ${selectedClient.invoice_cc_emails})` : ''}
                </div>
                {(!selectedClient.client_number || !(selectedClient.invoice_to_email || selectedClient.email)) && (
                  <div className="text-amber-600 mt-1">
                    Missing client # or invoice email — edit this client on the Clients tab first.
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>{invoiceType === 'recurring' ? 'Description Label' : 'Description'}</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
              {invoiceType === 'recurring' && (
                <span className="text-xs text-muted-foreground">
                  Printed as “{description || 'AMC'} for {'{'}Month{'}'} {'{'}Year{'}'}” each month
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount (INR)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            {invoiceType === 'onetime' ? (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} />
                    Send now
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={sendMode === 'schedule'} onChange={() => setSendMode('schedule')} />
                    Schedule for a date
                  </label>
                </div>
                {sendMode === 'schedule' && (
                  <DatePicker value={scheduledDate} onChange={setScheduledDate} placeholder="Pick a send date" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="sendNowRecurring" checked={sendNowRecurring}
                  onChange={e => setSendNowRecurring(e.target.checked)} />
                <Label htmlFor="sendNowRecurring">Also send this month&apos;s invoice now</Label>
              </div>
            )}
          </div>
          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="outline" onClick={previewDraft} disabled={!clientId}>
              <Eye size={14} className="mr-1" /> Preview
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Saving…' : invoiceType === 'recurring'
                  ? (sendNowRecurring ? 'Activate & Send Now' : 'Activate Recurring')
                  : (sendMode === 'now' ? 'Send Now' : 'Schedule Invoice')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringEditOpen} onOpenChange={v => !v && setRecurringEditOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Recurring Billing — {recurringEditClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Amount (INR)</Label>
              <Input type="number" value={recurringEditAmount} onChange={e => setRecurringEditAmount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description Label</Label>
              <Input value={recurringEditDescLabel} onChange={e => setRecurringEditDescLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringEditOpen(false)}>Cancel</Button>
            <Button onClick={saveRecurringEdit} disabled={recurringSaving}>{recurringSaving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
