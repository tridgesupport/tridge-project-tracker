import { sql } from '@/lib/db'
import { fyCodeForDate, formatInvoiceNumber, monthLabel } from '@/lib/invoice-number'
import { renderInvoicePDF } from '@/lib/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/invoice-email'
import type { Client } from '@/types'

export type InvoiceResult =
  | { outcome: 'sent'; invoiceNumber: string }
  | { outcome: 'skipped'; reason: string }
  | { outcome: 'failed'; invoiceNumber: string; error: string }

export async function generateAndSendInvoice(
  client: Client,
  invoiceDate: Date,
  opts: { force?: boolean } = {}
): Promise<InvoiceResult> {
  if (!client.amount || Number(client.amount) <= 0) {
    return { outcome: 'skipped', reason: 'No amount configured' }
  }
  const clientNumber = client.client_number
  if (!clientNumber) {
    return { outcome: 'skipped', reason: 'No client number assigned' }
  }
  const toEmail = client.invoice_to_email || client.email
  if (!toEmail) {
    return { outcome: 'skipped', reason: 'No invoice recipient email' }
  }

  const periodMonth = invoiceDate.getMonth() + 1
  const periodYear = invoiceDate.getFullYear()

  const existingRows = await sql`
    SELECT * FROM invoices
    WHERE client_id = ${client.id} AND period_month = ${periodMonth} AND period_year = ${periodYear}`
  const existing = existingRows[0] as
    | { id: string; invoice_number: string; fy_code: string; client_number: number; sequence_in_fy: number; status: string }
    | undefined

  if (existing && existing.status === 'sent' && !opts.force) {
    return { outcome: 'skipped', reason: 'Already invoiced for this period' }
  }

  const fyCode = existing?.fy_code || fyCodeForDate(invoiceDate)
  let sequenceInFy: number
  if (existing) {
    sequenceInFy = existing.sequence_in_fy
  } else {
    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM invoices
      WHERE client_id = ${client.id} AND fy_code = ${fyCode}`
    sequenceInFy = Number(countRows[0]?.count || 0) + 1
  }
  const invoiceNumber = existing?.invoice_number || formatInvoiceNumber({
    fyCode,
    clientNumber,
    sequenceInFy,
  })

  const toName = client.invoice_to_name || client.name
  const descriptionLabel = client.description_label || 'AMC'
  const label = monthLabel(periodMonth, periodYear)
  const description = `${descriptionLabel} for ${label}`
  const amount = Number(client.amount)

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null

  try {
    const pdfBuffer = await renderInvoicePDF({
      invoiceNumber,
      invoiceDate,
      toName,
      toAddress: client.invoice_address,
      gstin: client.gstin,
      descriptionLabel,
      monthLabel: label,
      amount,
      bankDetails: process.env.INVOICE_BANK_DETAILS || null,
    })

    await sendInvoiceEmail({
      toEmail,
      ccEmails: client.invoice_cc_emails,
      invoiceNumber,
      monthLabel: label,
      pdfBuffer,
    })
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const sentAt = status === 'sent' ? new Date().toISOString() : null

  if (existing) {
    // Keep the original invoice_date on retries/resends — only content and send status change.
    await sql`
      UPDATE invoices SET
        amount = ${amount}, description = ${description},
        invoice_to_name = ${toName}, invoice_address = ${client.invoice_address},
        gstin = ${client.gstin}, to_email = ${toEmail}, cc_emails = ${client.invoice_cc_emails},
        status = ${status}, error_message = ${errorMessage}, sent_at = ${sentAt}
      WHERE id = ${existing.id}`
  } else {
    await sql`
      INSERT INTO invoices (
        client_id, invoice_number, fy_code, client_number, sequence_in_fy,
        period_month, period_year, amount, description,
        invoice_to_name, invoice_address, gstin, to_email, cc_emails,
        invoice_date, status, error_message, sent_at
      ) VALUES (
        ${client.id}, ${invoiceNumber}, ${fyCode}, ${clientNumber}, ${sequenceInFy},
        ${periodMonth}, ${periodYear}, ${amount}, ${description},
        ${toName}, ${client.invoice_address}, ${client.gstin}, ${toEmail}, ${client.invoice_cc_emails},
        ${invoiceDate.toISOString().slice(0, 10)}, ${status}, ${errorMessage}, ${sentAt}
      )`
  }

  if (status === 'failed') {
    return { outcome: 'failed', invoiceNumber, error: errorMessage || 'Failed to send invoice' }
  }
  return { outcome: 'sent', invoiceNumber }
}

export async function buildInvoicePreviewNumber(client: Client, date: Date): Promise<string> {
  const fyCode = fyCodeForDate(date)
  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM invoices
    WHERE client_id = ${client.id} AND fy_code = ${fyCode}`
  const sequenceInFy = (countRows[0]?.count || 0) + 1
  return formatInvoiceNumber({ fyCode, clientNumber: client.client_number || 0, sequenceInFy })
}
