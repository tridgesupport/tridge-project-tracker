import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cancelScheduledInvoice } from '@/lib/invoice-generate'

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
