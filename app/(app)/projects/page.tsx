'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project, User, Client, ProjectStatus, ProjectType } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { DatePicker } from '@/components/DatePicker'
import { Plus, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

const ALL = 'all'
const NONE = '__none__'

const PROJECT_STATUSES: ProjectStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed', 'Scoping',
]
const PROJECT_TYPES: ProjectType[] = ['Internal R&D', 'Existing Client', 'Potential Client']
const PRIORITY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

function fmtDate(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yy') } catch { return d }
}

type SortState = { field: string; dir: 'asc' | 'desc' }

function sortBy<T>(items: T[], sort: SortState | null, val: (item: T, f: string) => unknown): T[] {
  if (!sort) return items
  return [...items].sort((a, b) => {
    const av = val(a, sort.field), bv = val(b, sort.field)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
    return sort.dir === 'asc' ? cmp : -cmp
  })
}

function SortHead({ label, field, sort, onSort, className }: {
  label: string; field: string; sort: SortState | null
  onSort: (f: string) => void; className?: string
}) {
  const active = sort?.field === field
  const Icon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap hover:text-foreground ${className ?? ''}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}<Icon size={12} className={active ? 'text-foreground' : 'text-muted-foreground/40'} />
      </div>
    </TableHead>
  )
}

type EditingCell = { projectId: string; field: string; textValue: string }

export default function ProjectsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [profile, setProfile] = useState<User | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [internalUsers, setInternalUsers] = useState<User[]>([])
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)

  function toggleSort(field: string) {
    setSort(s => s?.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }

  function projectVal(p: Project, f: string): unknown {
    const map: Record<string, unknown> = {
      project_name: p.project_name,
      customer: (p as any).customer?.name ?? '',
      owner_id: (p as any).owner?.name ?? '',
      project_type: p.project_type,
      status: p.status,
      priority: p.priority,
      expected_start_date: p.expected_start_date,
      expected_end_date: p.expected_end_date,
      next_action_by: (p as any).next_action_by_user?.name ?? '',
      last_edited_by: (p as any).last_edited_by_user?.name ?? '',
      last_edited_at: p.last_edited_at,
    }
    return map[f] ?? ''
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: prof }, { data: cls }, { data: usrs }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('clients').select('*').order('name'),
        supabase.from('users').select('*').order('name'),
      ])

      setProfile(prof)
      setClients(cls || [])
      setInternalUsers((usrs || []).filter((u: User) => u.role !== 'client'))

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
          .from('clients').select('id').eq('email', user.email).single()
        if (clientRec) query = query.eq('customer_id', clientRec.id)
      }

      const { data } = await query
      setProjects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const canEdit = profile?.role === 'admin' || profile?.role === 'internal'

  function isEditing(projectId: string, field: string) {
    return editingCell?.projectId === projectId && editingCell.field === field
  }

  function startTextEdit(e: React.MouseEvent, projectId: string, field: string, current: string) {
    e.stopPropagation()
    e.preventDefault()
    if (!canEdit) return
    setEditingCell({ projectId, field, textValue: current })
  }

  function startSelectEdit(e: React.MouseEvent, projectId: string, field: string) {
    e.stopPropagation()
    if (!canEdit) return
    setEditingCell({ projectId, field, textValue: '' })
  }

  async function saveEdit(projectId: string, field: string, value: unknown) {
    if (!profile) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    setEditingCell(null)

    const now = new Date().toISOString()
    const { error } = await supabase.from('projects').update({
      [field]: value,
      last_edited_by: profile.id,
      last_edited_at: now,
    }).eq('id', projectId)

    if (error) { toast.error('Save failed: ' + error.message); return }

    supabase.from('edit_log').insert({
      entity_type: 'project', entity_id: projectId,
      edited_by_email: profile.email, edited_at: now,
      changes: { [field]: { old: (project as any)[field], new: value } },
    }).then(() => {})

    if (field === 'next_action_by' && value && value !== project.next_action_by) {
      const assignee = internalUsers.find(u => u.id === value)
      if (assignee) {
        fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: assignee.email, toName: assignee.name, entityType: 'Project',
            entityName: project.project_name, projectName: project.project_name,
            appUrl: `${window.location.origin}/projects/${projectId}`,
          }),
        }).catch(() => {})
      }
    }

    // Optimistic local update — also resolve relation display fields
    const patch: Record<string, unknown> = {
      [field]: value,
      last_edited_by: profile.id,
      last_edited_at: now,
      last_edited_by_user: { id: profile.id, name: profile.name, email: profile.email },
    }
    if (field === 'customer_id')
      patch.customer = value ? (clients.find(c => c.id === value) ?? null) : null
    if (field === 'owner_id')
      patch.owner = value ? (internalUsers.find(u => u.id === value) ?? null) : null
    if (field === 'next_action_by')
      patch.next_action_by_user = value ? (internalUsers.find(u => u.id === value) ?? null) : null

    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...patch } : p))
  }

  async function commitText(projectId: string, field: string) {
    if (!editingCell || editingCell.projectId !== projectId || editingCell.field !== field) return
    const value = editingCell.textValue.trim()
    if (!value) { setEditingCell(null); return }
    await saveEdit(projectId, field, value)
  }

  const filtered = projects.filter(p => {
    if (statusFilter !== ALL && p.status !== statusFilter) return false
    if (typeFilter !== ALL && p.project_type !== typeFilter) return false
    return true
  })
  const sorted = sortBy(filtered, sort, projectVal)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold">Projects</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: string | null) => setStatusFilter(v || ALL)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v: string | null) => setTypeFilter(v || ALL)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && (
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
                <SortHead label="Project Name"   field="project_name"        sort={sort} onSort={toggleSort} />
                <SortHead label="Customer"        field="customer"            sort={sort} onSort={toggleSort} />
                <SortHead label="Owner"           field="owner_id"            sort={sort} onSort={toggleSort} />
                <SortHead label="Type"            field="project_type"        sort={sort} onSort={toggleSort} />
                <SortHead label="Status"          field="status"              sort={sort} onSort={toggleSort} />
                <SortHead label="Priority"        field="priority"            sort={sort} onSort={toggleSort} />
                <SortHead label="Start"           field="expected_start_date" sort={sort} onSort={toggleSort} />
                <SortHead label="End"             field="expected_end_date"   sort={sort} onSort={toggleSort} />
                <SortHead label="Next Action By"  field="next_action_by"      sort={sort} onSort={toggleSort} />
                <SortHead label="Last Edited By"  field="last_edited_by"      sort={sort} onSort={toggleSort} />
                <SortHead label="Last Edited At"  field="last_edited_at"      sort={sort} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/50">

                  {/* Project Name — pencil on hover to edit, link to navigate */}
                  <TableCell className="font-medium">
                    {isEditing(p.id, 'project_name') ? (
                      <Input
                        autoFocus
                        className="h-7 text-sm min-w-[180px]"
                        value={editingCell!.textValue}
                        onChange={e => setEditingCell(c => c ? { ...c, textValue: e.target.value } : null)}
                        onBlur={() => commitText(p.id, 'project_name')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitText(p.id, 'project_name')
                          if (e.key === 'Escape') setEditingCell(null)
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-primary hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {p.project_name}
                        </Link>
                        {canEdit && (
                          <Pencil
                            size={11}
                            className="text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                            onClick={e => startTextEdit(e, p.id, 'project_name', p.project_name)}
                          />
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Customer */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer' : ''}
                    onClick={e => startSelectEdit(e, p.id, 'customer_id')}
                  >
                    {isEditing(p.id, 'customer_id') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={(p as any).customer_id ?? NONE}
                        onValueChange={v => saveEdit(p.id, 'customer_id', v === NONE ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— None —</SelectItem>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{(p as any).customer?.name || '—'}</span>
                    )}
                  </TableCell>

                  {/* Owner */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer' : ''}
                    onClick={e => startSelectEdit(e, p.id, 'owner_id')}
                  >
                    {isEditing(p.id, 'owner_id') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={(p as any).owner_id ?? NONE}
                        onValueChange={v => saveEdit(p.id, 'owner_id', v === NONE ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— None —</SelectItem>
                          {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{(p as any).owner?.name || '—'}</span>
                    )}
                  </TableCell>

                  {/* Type */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'}
                    onClick={e => startSelectEdit(e, p.id, 'project_type')}
                  >
                    {isEditing(p.id, 'project_type') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={p.project_type}
                        onValueChange={v => saveEdit(p.id, 'project_type', v)}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      p.project_type
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer' : ''}
                    onClick={e => startSelectEdit(e, p.id, 'status')}
                  >
                    {isEditing(p.id, 'status') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={p.status}
                        onValueChange={v => saveEdit(p.id, 'status', v)}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge status={p.status} />
                    )}
                  </TableCell>

                  {/* Priority */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'}
                    onClick={e => startSelectEdit(e, p.id, 'priority')}
                  >
                    {isEditing(p.id, 'priority') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={p.priority !== null ? String(p.priority) : NONE}
                        onValueChange={v => saveEdit(p.id, 'priority', v === NONE ? null : Number(v))}
                      >
                        <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— None —</SelectItem>
                          {PRIORITY_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      p.priority ?? '—'
                    )}
                  </TableCell>

                  {/* Start date */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'}
                    onClick={e => startSelectEdit(e, p.id, 'expected_start_date')}
                  >
                    {isEditing(p.id, 'expected_start_date') ? (
                      <div onClick={e => e.stopPropagation()}>
                        <DatePicker
                          autoOpen
                          value={p.expected_start_date}
                          onChange={v => saveEdit(p.id, 'expected_start_date', v)}
                        />
                      </div>
                    ) : (
                      fmtDate(p.expected_start_date)
                    )}
                  </TableCell>

                  {/* End date */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'}
                    onClick={e => startSelectEdit(e, p.id, 'expected_end_date')}
                  >
                    {isEditing(p.id, 'expected_end_date') ? (
                      <div onClick={e => e.stopPropagation()}>
                        <DatePicker
                          autoOpen
                          value={p.expected_end_date}
                          onChange={v => saveEdit(p.id, 'expected_end_date', v)}
                        />
                      </div>
                    ) : (
                      fmtDate(p.expected_end_date)
                    )}
                  </TableCell>

                  {/* Next Action By */}
                  <TableCell
                    className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'}
                    onClick={e => startSelectEdit(e, p.id, 'next_action_by')}
                  >
                    {isEditing(p.id, 'next_action_by') ? (
                      <Select
                        open
                        onOpenChange={open => { if (!open) setEditingCell(null) }}
                        value={(p as any).next_action_by ?? NONE}
                        onValueChange={v => saveEdit(p.id, 'next_action_by', v === NONE ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— None —</SelectItem>
                          {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      (p as any).next_action_by_user?.name || '—'
                    )}
                  </TableCell>

                  {/* Read-only metadata */}
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
