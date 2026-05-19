'use client'

import { Fragment, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Milestone, Task, User, MilestoneStatus, TaskStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskModal } from '@/components/tasks/TaskModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const MILESTONE_STATUSES: MilestoneStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed',
]
const TASK_STATUSES: TaskStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed',
]

const NONE = '__none__'
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

interface MilestoneSectionProps {
  projectId: string
  projectName: string
  milestones: Milestone[]
  internalUsers: User[]
  currentUser: User
  canEdit: boolean
  onRefresh: () => Promise<void>
}

const emptyForm = () => ({
  milestone_name: '',
  description: '',
  start_date: null as string | null,
  end_date: null as string | null,
  status: 'Pending' as MilestoneStatus,
  assigned_to: null as string | null,
  next_action_by: null as string | null,
  priority: null as number | null,
})

export function MilestoneSection({
  projectId, projectName, milestones, internalUsers, currentUser, canEdit, onRefresh,
}: MilestoneSectionProps) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [milestoneSort, setMilestoneSort] = useState<SortState | null>(null)
  const [taskSort, setTaskSort] = useState<SortState | null>(null)
  const [taskEditingCell, setTaskEditingCell] = useState<{ taskId: string; field: string; textValue: string } | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [taskModal, setTaskModal] = useState<{ milestoneId: string; task: Task | null } | null>(null)
  const [milestoneForm, setMilestoneForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  function userName(id: string | null) {
    if (!id) return '—'
    return internalUsers.find(u => u.id === id)?.name || '—'
  }

  function toggleMilestoneSort(field: string) {
    setMilestoneSort(s => s?.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }
  function toggleTaskSort(field: string) {
    setTaskSort(s => s?.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }

  function milestoneVal(m: Milestone, f: string): unknown {
    const map: Record<string, unknown> = {
      milestone_name: m.milestone_name, status: m.status, priority: m.priority,
      start_date: m.start_date, end_date: m.end_date,
      assigned_to: userName(m.assigned_to), next_action_by: userName(m.next_action_by),
      last_edited_by: userName(m.last_edited_by), last_edited_at: m.last_edited_at,
    }
    return map[f] ?? ''
  }
  function taskVal(t: Task, f: string): unknown {
    const map: Record<string, unknown> = {
      task_name: t.task_name, status: t.status, priority: t.priority,
      start_date: t.start_date, end_date: t.end_date,
      assigned_to: userName(t.assigned_to), next_action_by: userName(t.next_action_by),
      last_edited_by: userName(t.last_edited_by), last_edited_at: t.last_edited_at,
    }
    return map[f] ?? ''
  }

  function isTaskEditing(taskId: string, field: string) {
    return taskEditingCell?.taskId === taskId && taskEditingCell.field === field
  }
  function startTaskTextEdit(e: React.MouseEvent, taskId: string, field: string, current: string) {
    e.stopPropagation()
    if (!canEdit) return
    setTaskEditingCell({ taskId, field, textValue: current })
  }
  function startTaskSelectEdit(e: React.MouseEvent, taskId: string, field: string) {
    e.stopPropagation()
    if (!canEdit) return
    setTaskEditingCell({ taskId, field, textValue: '' })
  }

  async function saveTaskEdit(taskId: string, milestoneId: string, field: string, value: unknown) {
    let task: Task | undefined
    for (const m of milestones) {
      task = m.tasks?.find(t => t.id === taskId)
      if (task) break
    }
    if (!task) return
    setTaskEditingCell(null)

    const now = new Date().toISOString()
    const { error } = await supabase.from('tasks').update({
      [field]: value,
      last_edited_by: currentUser.id,
      last_edited_at: now,
    }).eq('id', taskId)
    if (error) { toast.error('Save failed: ' + error.message); return }

    supabase.from('edit_log').insert({
      entity_type: 'task', entity_id: taskId,
      edited_by_email: currentUser.email, edited_at: now,
      changes: { [field]: { old: (task as any)[field], new: value } },
    }).then(() => {})

    if (field === 'next_action_by' && value && value !== task.next_action_by) {
      const assignee = internalUsers.find(u => u.id === value)
      if (assignee) {
        fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: assignee.email, toName: assignee.name, entityType: 'Task',
            entityName: task.task_name, projectName,
            appUrl: `${window.location.origin}/projects/${projectId}`,
          }),
        }).catch(() => {})
      }
    }
    await onRefresh()
  }

  async function commitTaskText(taskId: string, milestoneId: string, field: string) {
    if (!taskEditingCell || taskEditingCell.taskId !== taskId || taskEditingCell.field !== field) return
    const value = taskEditingCell.textValue.trim()
    if (!value) { setTaskEditingCell(null); return }
    await saveTaskEdit(taskId, milestoneId, field, value)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startAdd() {
    setMilestoneForm(emptyForm())
    setEditingMilestone(null)
    setAddingMilestone(true)
  }

  function startEdit(m: Milestone) {
    setMilestoneForm({
      milestone_name: m.milestone_name,
      description: m.description ?? '',
      start_date: m.start_date ?? null,
      end_date: m.end_date ?? null,
      status: m.status,
      assigned_to: m.assigned_to ?? null,
      next_action_by: m.next_action_by ?? null,
      priority: m.priority ?? null,
    })
    setEditingMilestone(m)
    setAddingMilestone(false)
  }

  function cancelForm() {
    setAddingMilestone(false)
    setEditingMilestone(null)
    setMilestoneForm(emptyForm())
  }

  const set = (k: keyof ReturnType<typeof emptyForm>, v: unknown) =>
    setMilestoneForm(f => ({ ...f, [k]: v }))

  async function saveMilestone() {
    if (!milestoneForm.milestone_name.trim()) {
      toast.error('Milestone name is required')
      return
    }
    setSaving(true)

    const payload = {
      milestone_name: milestoneForm.milestone_name.trim(),
      description: milestoneForm.description || null,
      start_date: milestoneForm.start_date || null,
      end_date: milestoneForm.end_date || null,
      status: milestoneForm.status,
      assigned_to: milestoneForm.assigned_to || null,
      next_action_by: milestoneForm.next_action_by || null,
      priority: milestoneForm.priority,
      project_id: projectId,
      last_edited_by: currentUser.id,
      last_edited_at: new Date().toISOString(),
    }

    if (editingMilestone) {
      const { error } = await supabase.from('milestones').update(payload).eq('id', editingMilestone.id)
      if (error) {
        console.error('Milestone update error:', error)
        toast.error('Save failed: ' + error.message)
        setSaving(false)
        return
      }

      const changes: Record<string, { old: unknown; new: unknown }> = {}
      const keys = Object.keys(milestoneForm) as (keyof typeof milestoneForm)[]
      for (const k of keys) {
        if (editingMilestone[k as keyof Milestone] !== milestoneForm[k]) {
          changes[k] = { old: editingMilestone[k as keyof Milestone], new: milestoneForm[k] }
        }
      }
      if (Object.keys(changes).length > 0) {
        const { error: logError } = await supabase.from('edit_log').insert({
          entity_type: 'milestone',
          entity_id: editingMilestone.id,
          edited_by_email: currentUser.email,
          edited_at: new Date().toISOString(),
          changes,
        })
        if (logError) console.error('Edit log error:', logError)
      }

      if (payload.next_action_by && payload.next_action_by !== editingMilestone.next_action_by) {
        const assignee = internalUsers.find(u => u.id === payload.next_action_by)
        if (assignee) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: assignee.email, toName: assignee.name, entityType: 'Milestone',
              entityName: milestoneForm.milestone_name, projectName,
              appUrl: `${window.location.origin}/projects/${projectId}`,
            }),
          }).catch(() => {})
        }
      }

      toast.success('Milestone saved')
    } else {
      const { data, error } = await supabase.from('milestones').insert(payload).select().single()
      if (error) {
        console.error('Milestone insert error:', error)
        toast.error('Save failed: ' + error.message)
        setSaving(false)
        return
      }
      if (data?.id) {
        setExpanded(prev => new Set([...prev, data.id]))
      }
      toast.success('Milestone added')
    }

    setSaving(false)
    cancelForm()
    await onRefresh()
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Delete this milestone and all its tasks?')) return
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Milestone deleted')
    await onRefresh()
  }

  // colSpan for the tasks sub-row: matches milestone column count
  const milestoneColSpan = canEdit ? 11 : 10

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Milestones</h2>
        {canEdit && !addingMilestone && !editingMilestone && (
          <Button size="sm" onClick={startAdd}>
            <Plus size={14} className="mr-1" /> Add Milestone
          </Button>
        )}
      </div>

      {/* Inline add/edit form */}
      {(addingMilestone || editingMilestone) && (
        <div className="border-2 border-primary/20 rounded-lg p-4 mb-4 bg-muted/20">
          <h3 className="font-semibold mb-3 text-sm">
            {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <Label className="text-xs font-medium">Milestone Name *</Label>
              <Input
                value={milestoneForm.milestone_name}
                onChange={e => set('milestone_name', e.target.value)}
                placeholder="e.g. Phase 1 — Data Collection"
                autoFocus
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={milestoneForm.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Start Date</Label>
              <DatePicker value={milestoneForm.start_date} onChange={v => set('start_date', v)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">End Date</Label>
              <DatePicker value={milestoneForm.end_date} onChange={v => set('end_date', v)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={milestoneForm.status}
                onValueChange={(v: string | null) => { if (v) set('status', v as MilestoneStatus) }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Assigned To</Label>
              <Select
                value={milestoneForm.assigned_to ?? NONE}
                onValueChange={(v: string | null) => set('assigned_to', (!v || v === NONE) ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Next Action By</Label>
              <Select
                value={milestoneForm.next_action_by ?? NONE}
                onValueChange={(v: string | null) => set('next_action_by', (!v || v === NONE) ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Priority</Label>
              <Select
                value={milestoneForm.priority !== null ? String(milestoneForm.priority) : NONE}
                onValueChange={(v: string | null) => set('priority', (!v || v === NONE) ? null : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {PRIORITY_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={saveMilestone} disabled={saving}>
              {saving ? 'Saving…' : editingMilestone ? 'Save Changes' : 'Add Milestone'}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelForm} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !addingMilestone ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">No milestones yet.</p>
          {canEdit && (
            <Button size="sm" onClick={startAdd}>
              <Plus size={14} className="mr-1" /> Add your first milestone
            </Button>
          )}
        </div>
      ) : milestones.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortHead label="Milestone Name"  field="milestone_name" sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Status"          field="status"         sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Priority"        field="priority"       sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Start"           field="start_date"     sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="End"             field="end_date"       sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Assigned To"     field="assigned_to"    sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Next Action By"  field="next_action_by" sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Last Edited By"  field="last_edited_by" sort={milestoneSort} onSort={toggleMilestoneSort} />
                <SortHead label="Last Edited At"  field="last_edited_at" sort={milestoneSort} onSort={toggleMilestoneSort} />
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortBy(milestones, milestoneSort, milestoneVal).map(m => (
                <Fragment key={m.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(m.id)}
                  >
                    <TableCell className="text-muted-foreground">
                      {expanded.has(m.id)
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />}
                    </TableCell>
                    <TableCell className="font-medium">{m.milestone_name}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-xs">{m.priority ?? '—'}</TableCell>
                    <TableCell className="text-xs">{fmtDate(m.start_date)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(m.end_date)}</TableCell>
                    <TableCell className="text-xs">{userName(m.assigned_to)}</TableCell>
                    <TableCell className="text-xs">{userName(m.next_action_by)}</TableCell>
                    <TableCell className="text-xs">{userName(m.last_edited_by)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(m.last_edited_at)}</TableCell>
                    {canEdit && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}>
                            <Pencil size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMilestone(m.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>

                  {expanded.has(m.id) && (
                    <TableRow>
                      <TableCell colSpan={milestoneColSpan} className="p-0 bg-muted/20">
                        <div className="px-8 py-4">
                          {m.description && (
                            <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Tasks ({m.tasks?.length ?? 0})
                            </span>
                            {canEdit && (
                              <Button size="sm" onClick={() => setTaskModal({ milestoneId: m.id, task: null })}>
                                <Plus size={12} className="mr-1" /> Add Task
                              </Button>
                            )}
                          </div>

                          {(!m.tasks || m.tasks.length === 0) ? (
                            <div className="text-center py-4 border border-dashed rounded-md">
                              <p className="text-xs text-muted-foreground mb-2">No tasks yet.</p>
                              {canEdit && (
                                <Button size="sm" variant="outline" onClick={() => setTaskModal({ milestoneId: m.id, task: null })}>
                                  <Plus size={12} className="mr-1" /> Add Task
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-md border overflow-x-auto bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <SortHead label="Task Name"      field="task_name"      sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Status"         field="status"         sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Priority"       field="priority"       sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Start"          field="start_date"     sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="End"            field="end_date"       sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Assigned To"    field="assigned_to"    sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Next Action By" field="next_action_by" sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Last Edited By" field="last_edited_by" sort={taskSort} onSort={toggleTaskSort} />
                                    <SortHead label="Last Edited At" field="last_edited_at" sort={taskSort} onSort={toggleTaskSort} />
                                    {canEdit && <TableHead className="w-12" />}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortBy(m.tasks, taskSort, taskVal).map(t => (
                                    <TableRow key={t.id} className="hover:bg-muted/50">

                                      {/* Task Name */}
                                      <TableCell className="font-medium">
                                        {isTaskEditing(t.id, 'task_name') ? (
                                          <Input
                                            autoFocus
                                            className="h-7 text-sm min-w-[160px]"
                                            value={taskEditingCell!.textValue}
                                            onChange={e => setTaskEditingCell(c => c ? { ...c, textValue: e.target.value } : null)}
                                            onBlur={() => commitTaskText(t.id, m.id, 'task_name')}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') commitTaskText(t.id, m.id, 'task_name')
                                              if (e.key === 'Escape') setTaskEditingCell(null)
                                            }}
                                          />
                                        ) : (
                                          <div className="flex items-center gap-1.5 group">
                                            <span>{t.task_name}</span>
                                            {canEdit && (
                                              <Pencil
                                                size={11}
                                                className="text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                                                onClick={e => startTaskTextEdit(e, t.id, 'task_name', t.task_name)}
                                              />
                                            )}
                                          </div>
                                        )}
                                      </TableCell>

                                      {/* Status */}
                                      <TableCell className={canEdit ? 'cursor-pointer' : ''} onClick={e => startTaskSelectEdit(e, t.id, 'status')}>
                                        {isTaskEditing(t.id, 'status') ? (
                                          <Select open onOpenChange={open => { if (!open) setTaskEditingCell(null) }} value={t.status} onValueChange={v => saveTaskEdit(t.id, m.id, 'status', v)}>
                                            <SelectTrigger className="h-7 text-xs min-w-[150px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                          </Select>
                                        ) : <StatusBadge status={t.status} />}
                                      </TableCell>

                                      {/* Priority */}
                                      <TableCell className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'} onClick={e => startTaskSelectEdit(e, t.id, 'priority')}>
                                        {isTaskEditing(t.id, 'priority') ? (
                                          <Select open onOpenChange={open => { if (!open) setTaskEditingCell(null) }} value={t.priority !== null ? String(t.priority) : NONE} onValueChange={v => saveTaskEdit(t.id, m.id, 'priority', v === NONE ? null : Number(v))}>
                                            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value={NONE}>— None —</SelectItem>
                                              {PRIORITY_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        ) : t.priority ?? '—'}
                                      </TableCell>

                                      {/* Start date */}
                                      <TableCell className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'} onClick={e => startTaskSelectEdit(e, t.id, 'start_date')}>
                                        {isTaskEditing(t.id, 'start_date') ? (
                                          <div onClick={e => e.stopPropagation()}>
                                            <DatePicker autoOpen value={t.start_date} onChange={v => saveTaskEdit(t.id, m.id, 'start_date', v)} />
                                          </div>
                                        ) : fmtDate(t.start_date)}
                                      </TableCell>

                                      {/* End date */}
                                      <TableCell className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'} onClick={e => startTaskSelectEdit(e, t.id, 'end_date')}>
                                        {isTaskEditing(t.id, 'end_date') ? (
                                          <div onClick={e => e.stopPropagation()}>
                                            <DatePicker autoOpen value={t.end_date} onChange={v => saveTaskEdit(t.id, m.id, 'end_date', v)} />
                                          </div>
                                        ) : fmtDate(t.end_date)}
                                      </TableCell>

                                      {/* Assigned To */}
                                      <TableCell className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'} onClick={e => startTaskSelectEdit(e, t.id, 'assigned_to')}>
                                        {isTaskEditing(t.id, 'assigned_to') ? (
                                          <Select open onOpenChange={open => { if (!open) setTaskEditingCell(null) }} value={t.assigned_to ?? NONE} onValueChange={v => saveTaskEdit(t.id, m.id, 'assigned_to', v === NONE ? null : v)}>
                                            <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value={NONE}>— None —</SelectItem>
                                              {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        ) : userName(t.assigned_to)}
                                      </TableCell>

                                      {/* Next Action By */}
                                      <TableCell className={canEdit ? 'cursor-pointer text-xs' : 'text-xs'} onClick={e => startTaskSelectEdit(e, t.id, 'next_action_by')}>
                                        {isTaskEditing(t.id, 'next_action_by') ? (
                                          <Select open onOpenChange={open => { if (!open) setTaskEditingCell(null) }} value={t.next_action_by ?? NONE} onValueChange={v => saveTaskEdit(t.id, m.id, 'next_action_by', v === NONE ? null : v)}>
                                            <SelectTrigger className="h-7 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value={NONE}>— None —</SelectItem>
                                              {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        ) : userName(t.next_action_by)}
                                      </TableCell>

                                      {/* Read-only metadata */}
                                      <TableCell className="text-xs">{userName(t.last_edited_by)}</TableCell>
                                      <TableCell className="text-xs">{fmtDate(t.last_edited_at)}</TableCell>

                                      {/* Full-edit modal button */}
                                      {canEdit && (
                                        <TableCell>
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTaskModal({ milestoneId: m.id, task: t })}>
                                            <Pencil size={12} />
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {taskModal && (
        <TaskModal
          open
          onClose={() => setTaskModal(null)}
          onSaved={async () => { await onRefresh() }}
          milestoneId={taskModal.milestoneId}
          projectId={projectId}
          task={taskModal.task}
          internalUsers={internalUsers}
          currentUser={currentUser}
          projectName={projectName}
        />
      )}
    </div>
  )
}
