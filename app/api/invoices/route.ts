import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { createManualInvoice } from '@/lib/invoice-generate'
import type { Client } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { clientId, description, amount, sendNow, scheduledDate } = body

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  if (!sendNow && !scheduledDate) {
    return NextResponse.json({ error: 'scheduledDate is required when not sending immediately' }, { status: 400 })
  }

  const rows = await sql`SELECT * FROM clients WHERE id = ${clientId}`
  const client = rows[0] as Client | undefined
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const invoiceDate = sendNow ? new Date() : new Date(`${scheduledDate}T00:00:00`)

  const result = await createManualInvoice({
    client,
    description: String(description || ''),
    amount: Number(amount),
    invoiceDate,
    sendNow: Boolean(sendNow),
  })

  if (result.outcome === 'skipped') {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }
  if (result.outcome === 'failed') {
    return NextResponse.json({ error: result.error, invoiceNumber: result.invoiceNumber }, { status: 502 })
  }
  return NextResponse.json(result)
}
