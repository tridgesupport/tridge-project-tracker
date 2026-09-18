import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { cancelScheduledInvoice } from '@/lib/invoice-generate'

const PAYMENT_STATUSES = ['unpaid', 'paid', 'overdue']

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const result = await cancelScheduledInvoice(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { payment_status } = await req.json()
  if (!PAYMENT_STATUSES.includes(payment_status))
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })

  await sql`UPDATE invoices SET payment_status = ${payment_status} WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
