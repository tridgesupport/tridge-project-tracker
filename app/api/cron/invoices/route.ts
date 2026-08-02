import { NextResponse } from 'next/server'
import { isLastDayOfMonth } from 'date-fns'
import { sql } from '@/lib/db'
import { generateAndSendInvoice } from '@/lib/invoice-generate'
import { billingDateForPeriod } from '@/lib/invoice-number'
import type { Client } from '@/types'

export const runtime = 'nodejs'

// Sends on the 30th of every month; falls back to the last day of February
// (which never has a 30th).
function shouldRunToday(date: Date): boolean {
  return date.getDate() === 30 || (date.getMonth() === 1 && isLastDayOfMonth(date))
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  if (!shouldRunToday(now)) {
    return NextResponse.json({ ran: false, reason: 'Not the scheduled billing day' })
  }

  const invoiceDate = billingDateForPeriod(now.getMonth() + 1, now.getFullYear())

  const clients = (await sql`
    SELECT * FROM clients WHERE auto_invoice_active AND amount > 0
  `) as Client[]

  const results = []
  for (const client of clients) {
    try {
      const result = await generateAndSendInvoice(client, invoiceDate)
      results.push({ clientId: client.id, clientName: client.name, ...result })
    } catch (err) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        outcome: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ran: true, count: clients.length, results })
}
