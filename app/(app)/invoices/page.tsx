'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Client, Invoice } from '@/types'
import { getClients, getInvoices, createInvoice, sendInvoiceNow, cancelInvoice } from '@/lib/api'
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
import { Plus, Eye, Send, X } from 'lucide-react'

type InvoiceWithClient = Invoice & { client_name: string }

const statusStyles: Record<string, string> = {
  scheduled: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

function defaultDescription(client: Client) {
  const now = new Date()
  return `${client.description_label || 'AMC'} for ${monthLabel(now.getMonth() + 1, now.getFullYear())}`
}

export default function InvoicesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const role = (session?.user as unknown as Record<string, string>)?.role
  const selectedClient = clients.find(c => c.id === clientId) || null

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

  function openCreate() {
    setClientId('')
    setDescription('')
    setAmount('')
    setSendMode('now')
    setScheduledDate(null)
    setCreateOpen(true)
  }

  function handleClientChange(id: string | null) {
    setClientId(id || '')
    const c = clients.find(x => x.id === id)
    if (c) {
      setDescription(defaultDescription(c))
      setAmount(c.amount != null ? String(c.amount) : '')
    }
  }

  function previewDraft() {
    if (!clientId) return
    const params = new URLSearchParams({ amount: amount || '0', description: description || '' })
    window.open(`/api/invoices/client/${clientId}/preview?${params.toString()}`, '_blank')
  }

  async function handleCreate() {
    if (!clientId) { toast.error('Pick a client'); return }
    if (!description.trim()) { toast.error('Description is required'); return }
    if (!amount || Number(amount) <= 0) { toast.error('Amount is required'); return }
    if (sendMode === 'schedule' && !scheduledDate) { toast.error('Pick a date to schedule for'); return }

    setCreating(true)
    try {
      await createInvoice({
        clientId,
        description: description.trim(),
        amount: Number(amount),
        sendNow: sendMode === 'now',
        scheduledDate: sendMode === 'schedule' ? scheduledDate! : undefined,
      })
      toast.success(sendMode === 'now' ? 'Invoice sent' : 'Invoice scheduled')
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" />Create Invoice</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Pick a client to autofill their billing details, then send now or schedule for a date.
        Clients marked Active on the Clients tab are also billed automatically on the 30th of every month.
      </p>

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
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">No invoices yet.</TableCell></TableRow>
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

      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
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
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount (INR)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

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
          </div>
          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="outline" onClick={previewDraft} disabled={!clientId}>
              <Eye size={14} className="mr-1" /> Preview
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Saving…' : sendMode === 'now' ? 'Send Now' : 'Schedule Invoice'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
