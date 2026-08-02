import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { renderInvoicePDF } from '@/lib/invoice-pdf'
import { monthLabel } from '@/lib/invoice-number'
import { buildInvoicePreviewNumber } from '@/lib/invoice-generate'
import type { Client } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
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

  // Draft amount/description let the Create Invoice dialog preview a manual
  // invoice before it's created; falls back to the client's stored defaults.
  const amountParam = req.nextUrl.searchParams.get('amount')
  const descriptionParam = req.nextUrl.searchParams.get('description')
  const amount = amountParam ? Number(amountParam) : Number(client.amount || 0)
  const description = descriptionParam ||
    `${client.description_label || 'AMC'} for ${monthLabel(now.getMonth() + 1, now.getFullYear())}`

  const pdfBuffer = await renderInvoicePDF({
    invoiceNumber,
    invoiceDate: now,
    toName: client.invoice_to_name || client.name,
    toAddress: client.invoice_address,
    gstin: client.gstin,
    description,
    amount,
    bankDetails: process.env.INVOICE_BANK_DETAILS || null,
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Invoice ${invoiceNumber} Preview.pdf"`,
    },
  })
}
