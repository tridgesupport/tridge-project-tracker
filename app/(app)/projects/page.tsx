'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project, User, ProjectStatus, ProjectType } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const ALL = 'all'

const PROJECT_STATUSES: ProjectStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed', 'Scoping',
]
const PROJECT_TYPES: ProjectType[] = ['Internal R&D', 'Existing Client', 'Potential Client']

function fmtDate(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yy') } catch { return d }
}

export default function ProjectsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [profile, setProfile] = useState<User | null>(null)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(prof)

      let query = supabase
        .from('projects')
        .select(`
          *,
          owner:users!projects_owner_id_fkey(id,name,email),
          customer:clients(id,name),
          next_action_by_user:users!projects_next_action_by_fkey(id,name,email),
          last_edited_by_user:users!projects_last_edited_by_fkey(id,name,email)
        `)
        .order('created_at', { ascending: false })

      if (prof?.role === 'client') {
        const { data: clientRec } = await supabase
          .from('clients')
          .select('id')
          .eq('email', user.email)
          .single()
        if (clientRec) query = query.eq('customer_id', clientRec.id)
      }

      const { data } = await query
      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = projects.filter(p => {
    if (statusFilter !== ALL && p.status !== statusFilter) return false
    if (typeFilter !== ALL && p.project_type !== typeFilter) return false
    return true
  })

  const canCreate = profile?.role === 'admin' || profile?.role === 'internal'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold">Projects</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: string | null) => setStatusFilter(v || ALL)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v: string | null) => setTypeFilter(v || ALL)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {canCreate && (
            <Link href="/projects/new" className={buttonVariants()}>
              <Plus size={16} className="mr-1" />New Project
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground text-sm">No projects found.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Next Action By</TableHead>
                <TableHead>Last Edited By</TableHead>
                <TableHead>Last Edited At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.project_name}
                    </Link>
                  </TableCell>
                  <TableCell>{(p as any).customer?.name || '—'}</TableCell>
                  <TableCell>{(p as any).owner?.name || '—'}</TableCell>
                  <TableCell className="text-xs">{p.project_type}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-xs">{fmtDate(p.expected_start_date)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.expected_end_date)}</TableCell>
                  <TableCell className="text-xs">{(p as any).next_action_by_user?.name || '—'}</TableCell>
                  <TableCell className="text-xs">{(p as any).last_edited_by_user?.name || '—'}</TableCell>
                  <TableCell className="text-xs">{p.last_edited_at ? fmtDate(p.last_edited_at) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
