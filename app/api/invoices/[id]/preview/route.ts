import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { renderInvoicePDF } from '@/lib/invoice-pdf'
import type { Invoice } from '@/types'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
  const invoice = rows[0] as Invoice | undefined
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const pdfBuffer = await renderInvoicePDF({
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.invoice_date),
    toName: invoice.invoice_to_name,
    toAddress: invoice.invoice_address,
    gstin: invoice.gstin,
    description: invoice.description,
    amount: Number(invoice.amount),
    bankDetails: process.env.INVOICE_BANK_DETAILS || null,
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Invoice ${invoice.invoice_number}.pdf"`,
    },
  })
}
