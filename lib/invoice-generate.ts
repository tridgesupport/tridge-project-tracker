import { sql } from '@/lib/db'
import { fyCodeForDate, formatInvoiceNumber, monthLabel, toDateString } from '@/lib/invoice-number'
import { renderInvoicePDF } from '@/lib/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/invoice-email'
import type { Client, Invoice } from '@/types'

export type InvoiceResult =
  | { outcome: 'sent'; invoiceId: string; invoiceNumber: string }
  | { outcome: 'scheduled'; invoiceId: string; invoiceNumber: string }
  | { outcome: 'skipped'; reason: string }
  | { outcome: 'failed'; invoiceId: string; invoiceNumber: string; error: string }

function resolveBillingFields(client: Client): { clientNumber: number; toEmail: string; toName: string } | { error: string } {
  if (!client.client_number) return { error: 'No client number assigned' }
  const toEmail = client.invoice_to_email || client.email
  if (!toEmail) return { error: 'No invoice recipient email' }
  const toName = client.invoice_to_name || client.name
  return { clientNumber: client.client_number, toEmail, toName }
}

async function nextInvoiceNumber(clientId: string, clientNumber: number, invoiceDate: Date): Promise<{ fyCode: string; sequenceInFy: number; invoiceNumber: string }> {
  const fyCode = fyCodeForDate(invoiceDate)
  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM invoices
    WHERE client_id = ${clientId} AND fy_code = ${fyCode}`
  const sequenceInFy = Number(countRows[0]?.count || 0) + 1
  const invoiceNumber = formatInvoiceNumber({ fyCode, clientNumber, sequenceInFy })
  return { fyCode, sequenceInFy, invoiceNumber }
}

async function renderAndSend(params: {
  invoiceNumber: string
  invoiceDate: Date
  toName: string
  toAddress: string | null
  gstin: string | null
  description: string
  amount: number
  toEmail: string
  ccEmails: string | null
}): Promise<{ status: 'sent' | 'failed'; errorMessage: string | null }> {
  try {
    const pdfBuffer = await renderInvoicePDF({
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      toName: params.toName,
      toAddress: params.toAddress,
      gstin: params.gstin,
      description: params.description,
      amount: params.amount,
      bankDetails: process.env.INVOICE_BANK_DETAILS || null,
    })
    await sendInvoiceEmail({
      toEmail: params.toEmail,
      ccEmails: params.ccEmails,
      invoiceNumber: params.invoiceNumber,
      description: params.description,
      pdfBuffer,
    })
    return { status: 'sent', errorMessage: null }
  } catch (err) {
    return { status: 'failed', errorMessage: err instanceof Error ? err.message : String(err) }
  }
}

// Recurring monthly billing (cron-driven). Never double-bills a client for the
// same period — the (client_id, period_year, period_month) uniqueness is
// enforced by a partial index scoped to source='recurring' in the DB, so this
// can coexist with any number of manual invoices in the same month.
export async function generateAndSendInvoice(
  client: Client,
  invoiceDate: Date,
  opts: { force?: boolean } = {}
): Promise<InvoiceResult> {
  if (!client.amount || Number(client.amount) <= 0) {
    return { outcome: 'skipped', reason: 'No amount configured' }
  }
  const billing = resolveBillingFields(client)
  if ('error' in billing) return { outcome: 'skipped', reason: billing.error }
  const { clientNumber, toEmail, toName } = billing

  const periodMonth = invoiceDate.getMonth() + 1
  const periodYear = invoiceDate.getFullYear()

  const existingRows = await sql`
    SELECT * FROM invoices
    WHERE client_id = ${client.id} AND period_month = ${periodMonth} AND period_year = ${periodYear} AND source = 'recurring'`
  const existing = existingRows[0] as
    | { id: string; invoice_number: string; fy_code: string; sequence_in_fy: number; status: string }
    | undefined

  if (existing && existing.status === 'sent' && !opts.force) {
    return { outcome: 'skipped', reason: 'Already invoiced for this period' }
  }

  let fyCode: string
  let sequenceInFy: number
  let invoiceNumber: string
  if (existing) {
    fyCode = existing.fy_code
    sequenceInFy = existing.sequence_in_fy
    invoiceNumber = existing.invoice_number
  } else {
    const allocated = await nextInvoiceNumber(client.id, clientNumber, invoiceDate)
    fyCode = allocated.fyCode
    sequenceInFy = allocated.sequenceInFy
    invoiceNumber = allocated.invoiceNumber
  }

  const descriptionLabel = client.description_label || 'AMC'
  const label = monthLabel(periodMonth, periodYear)
  const description = `${descriptionLabel} for ${label}`
  const amount = Number(client.amount)

  const { status, errorMessage } = await renderAndSend({
    invoiceNumber, invoiceDate, toName, toAddress: client.invoice_address, gstin: client.gstin,
    description, amount, toEmail, ccEmails: client.invoice_cc_emails,
  })
  const sentAt = status === 'sent' ? new Date().toISOString() : null

  let invoiceId: string
  if (existing) {
    await sql`
      UPDATE invoices SET
        amount = ${amount}, description = ${description},
        invoice_to_name = ${toName}, invoice_address = ${client.invoice_address},
        gstin = ${client.gstin}, to_email = ${toEmail}, cc_emails = ${client.invoice_cc_emails},
        status = ${status}, error_message = ${errorMessage}, sent_at = ${sentAt}
      WHERE id = ${existing.id}`
    invoiceId = existing.id
  } else {
    const rows = await sql`
      INSERT INTO invoices (
        client_id, invoice_number, fy_code, client_number, sequence_in_fy,
        period_month, period_year, amount, description, source,
        invoice_to_name, invoice_address, gstin, to_email, cc_emails,
        invoice_date, status, error_message, sent_at
      ) VALUES (
        ${client.id}, ${invoiceNumber}, ${fyCode}, ${clientNumber}, ${sequenceInFy},
        ${periodMonth}, ${periodYear}, ${amount}, ${description}, 'recurring',
        ${toName}, ${client.invoice_address}, ${client.gstin}, ${toEmail}, ${client.invoice_cc_emails},
        ${toDateString(invoiceDate)}, ${status}, ${errorMessage}, ${sentAt}
      ) RETURNING id`
    invoiceId = rows[0].id
  }

  if (status === 'failed') {
    return { outcome: 'failed', invoiceId, invoiceNumber, error: errorMessage || 'Failed to send invoice' }
  }
  return { outcome: 'sent', invoiceId, invoiceNumber }
}

// One-off or scheduled invoice created via the Create Invoice flow. Always
// allocates a fresh invoice number — no period-based idempotency, so a client
// can receive any number of manual invoices alongside their recurring one.
export async function createManualInvoice({
  client,
  description,
  amount,
  invoiceDate,
  sendNow,
}: {
  client: Client
  description: string
  amount: number
  invoiceDate: Date
  sendNow: boolean
}): Promise<InvoiceResult> {
  if (!amount || amount <= 0) return { outcome: 'skipped', reason: 'Amount is required' }
  if (!description.trim()) return { outcome: 'skipped', reason: 'Description is required' }
  const billing = resolveBillingFields(client)
  if ('error' in billing) return { outcome: 'skipped', reason: billing.error }
  const { clientNumber, toEmail, toName } = billing

  const { fyCode, sequenceInFy, invoiceNumber } = await nextInvoiceNumber(client.id, clientNumber, invoiceDate)
  const periodMonth = invoiceDate.getMonth() + 1
  const periodYear = invoiceDate.getFullYear()

  if (!sendNow) {
    const rows = await sql`
      INSERT INTO invoices (
        client_id, invoice_number, fy_code, client_number, sequence_in_fy,
        period_month, period_year, amount, description, source,
        invoice_to_name, invoice_address, gstin, to_email, cc_emails,
        invoice_date, status, scheduled_date
      ) VALUES (
        ${client.id}, ${invoiceNumber}, ${fyCode}, ${clientNumber}, ${sequenceInFy},
        ${periodMonth}, ${periodYear}, ${amount}, ${description}, 'manual',
        ${toName}, ${client.invoice_address}, ${client.gstin}, ${toEmail}, ${client.invoice_cc_emails},
        ${toDateString(invoiceDate)}, 'scheduled', ${toDateString(invoiceDate)}
      ) RETURNING id`
    return { outcome: 'scheduled', invoiceId: rows[0].id, invoiceNumber }
  }

  const { status, errorMessage } = await renderAndSend({
    invoiceNumber, invoiceDate, toName, toAddress: client.invoice_address, gstin: client.gstin,
    description, amount, toEmail, ccEmails: client.invoice_cc_emails,
  })
  const rows = await sql`
    INSERT INTO invoices (
      client_id, invoice_number, fy_code, client_number, sequence_in_fy,
      period_month, period_year, amount, description, source,
      invoice_to_name, invoice_address, gstin, to_email, cc_emails,
      invoice_date, status, error_message, sent_at
    ) VALUES (
      ${client.id}, ${invoiceNumber}, ${fyCode}, ${clientNumber}, ${sequenceInFy},
      ${periodMonth}, ${periodYear}, ${amount}, ${description}, 'manual',
      ${toName}, ${client.invoice_address}, ${client.gstin}, ${toEmail}, ${client.invoice_cc_emails},
      ${toDateString(invoiceDate)}, ${status}, ${errorMessage},
      ${status === 'sent' ? new Date().toISOString() : null}
    ) RETURNING id`
  const invoiceId = rows[0].id

  if (status === 'failed') {
    return { outcome: 'failed', invoiceId, invoiceNumber, error: errorMessage || 'Failed to send invoice' }
  }
  return { outcome: 'sent', invoiceId, invoiceNumber }
}

// Sends a scheduled or previously-failed invoice using its own stored
// snapshot — not the client's current data — so what was previewed/created is
// exactly what goes out, even if the client record changes later. Used by the
// daily cron sweep for due scheduled invoices and by manual "Send Now".
export async function sendPendingInvoice(invoice: Invoice): Promise<InvoiceResult> {
  if (!invoice.to_email) {
    await sql`UPDATE invoices SET status = 'failed', error_message = 'No recipient email' WHERE id = ${invoice.id}`
    return { outcome: 'failed', invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, error: 'No recipient email' }
  }

  const { status, errorMessage } = await renderAndSend({
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.invoice_date),
    toName: invoice.invoice_to_name,
    toAddress: invoice.invoice_address,
    gstin: invoice.gstin,
    description: invoice.description,
    amount: Number(invoice.amount),
    toEmail: invoice.to_email,
    ccEmails: invoice.cc_emails,
  })
  await sql`
    UPDATE invoices SET status = ${status}, error_message = ${errorMessage}, sent_at = ${status === 'sent' ? new Date().toISOString() : null}
    WHERE id = ${invoice.id}`

  if (status === 'failed') {
    return { outcome: 'failed', invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, error: errorMessage || 'Failed to send invoice' }
  }
  return { outcome: 'sent', invoiceId: invoice.id, invoiceNumber: invoice.invoice_number }
}

// Cancels a not-yet-sent manual invoice. Sent/failed rows are real history
// and are never deletable this way.
export async function cancelScheduledInvoice(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  const rows = await sql`DELETE FROM invoices WHERE id = ${invoiceId} AND status = 'scheduled' RETURNING id`
  if (rows.length === 0) return { ok: false, error: 'Invoice not found or already sent' }
  return { ok: true }
}

export async function buildInvoicePreviewNumber(client: Client, date: Date): Promise<string> {
  const fyCode = fyCodeForDate(date)
  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM invoices
    WHERE client_id = ${client.id} AND fy_code = ${fyCode}`
  const sequenceInFy = (countRows[0]?.count || 0) + 1
  return formatInvoiceNumber({ fyCode, clientNumber: client.client_number || 0, sequenceInFy })
}
