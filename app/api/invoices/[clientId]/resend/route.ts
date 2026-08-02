import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { generateAndSendInvoice } from '@/lib/invoice-generate'
import { billingDateForPeriod } from '@/lib/invoice-number'
import type { Client } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientId } = await params
  const rows = await sql`SELECT * FROM clients WHERE id = ${clientId}`
  const client = rows[0] as Client | undefined
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const periodMonth = body.periodMonth ?? now.getMonth() + 1
  const periodYear = body.periodYear ?? now.getFullYear()
  const invoiceDate = billingDateForPeriod(periodMonth, periodYear)

  const result = await generateAndSendInvoice(client, invoiceDate, { force: true })

  if (result.outcome === 'failed') {
    return NextResponse.json({ error: result.error, invoiceNumber: result.invoiceNumber }, { status: 502 })
  }
  return NextResponse.json(result)
}
