import { NextResponse } from 'next/server'
import { isLastDayOfMonth } from 'date-fns'
import { sql } from '@/lib/db'
import { generateAndSendInvoice, sendPendingInvoice } from '@/lib/invoice-generate'
import { billingDateForPeriod } from '@/lib/invoice-number'
import type { Client, Invoice } from '@/types'

export const runtime = 'nodejs'

// Recurring monthly billing fires on the 30th of every month; falls back to
// the last day of February (which never has a 30th).
function shouldRunRecurringToday(date: Date): boolean {
  return date.getDate() === 30 || (date.getMonth() === 1 && isLastDayOfMonth(date))
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: unknown[] = []

  // Phase 1: recurring monthly invoices for active clients (30th of month only).
  let recurringRan = false
  if (shouldRunRecurringToday(now)) {
    recurringRan = true
    const invoiceDate = billingDateForPeriod(now.getMonth() + 1, now.getFullYear())
    const clients = (await sql`
      SELECT * FROM clients WHERE auto_invoice_active AND amount > 0
    `) as Client[]
    for (const client of clients) {
      try {
        const result = await generateAndSendInvoice(client, invoiceDate)
        results.push({ type: 'recurring', clientId: client.id, clientName: client.name, ...result })
      } catch (err) {
        results.push({
          type: 'recurring', clientId: client.id, clientName: client.name,
          outcome: 'failed', error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // Phase 2: any manually-scheduled invoices whose date has arrived — runs every day.
  const due = (await sql`
    SELECT * FROM invoices WHERE status = 'scheduled' AND scheduled_date <= CURRENT_DATE
  `) as Invoice[]
  for (const invoice of due) {
    try {
      const result = await sendPendingInvoice(invoice)
      results.push({ type: 'scheduled', invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, ...result })
    } catch (err) {
      results.push({
        type: 'scheduled', invoiceId: invoice.id, invoiceNumber: invoice.invoice_number,
        outcome: 'failed', error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ran: true, recurringRan, scheduledCount: due.length, results })
}
