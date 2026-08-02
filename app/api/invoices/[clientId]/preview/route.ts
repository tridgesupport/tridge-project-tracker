import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { renderInvoicePDF } from '@/lib/invoice-pdf'
import { monthLabel } from '@/lib/invoice-number'
import { buildInvoicePreviewNumber } from '@/lib/invoice-generate'
import type { Client } from '@/types'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientId } = await params
  const rows = await sql`SELECT * FROM clients WHERE id = ${clientId}`
  const client = rows[0] as Client | undefined
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const now = new Date()
  const invoiceNumber = await buildInvoicePreviewNumber(client, now)

  const pdfBuffer = await renderInvoicePDF({
    invoiceNumber,
    invoiceDate: now,
    toName: client.invoice_to_name || client.name,
    toAddress: client.invoice_address,
    gstin: client.gstin,
    descriptionLabel: client.description_label || 'AMC',
    monthLabel: monthLabel(now.getMonth() + 1, now.getFullYear()),
    amount: Number(client.amount || 0),
    bankDetails: process.env.INVOICE_BANK_DETAILS || null,
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Invoice ${invoiceNumber} Preview.pdf"`,
    },
  })
}
