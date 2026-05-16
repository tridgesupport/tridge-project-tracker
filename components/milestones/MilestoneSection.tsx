'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Milestone, Task, User, MilestoneStatus } from '@/types'
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
import { DatePicker } from '@/components/DatePicker'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const MILESTONE_STATUSES: MilestoneStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed',
]

const NONE = '__none__'
const PRIORITY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

function fmtDate(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yy') } catch { return d }
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
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [taskModal, setTaskModal] = useState<{ milestoneId: string; task: Task | null } | null>(null)
  const [milestoneForm, setMilestoneForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

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
      // Auto-expand the new milestone so the user can immediately add tasks
      if (data?.id) {
        setExpanded(prev => new Set([...prev, data.id]))
      }
      toast.success('Milestone added — expand it below to add tasks')
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

      {milestones.length === 0 && !addingMilestone && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">No milestones yet.</p>
          {canEdit && (
            <Button size="sm" onClick={startAdd}>
              <Plus size={14} className="mr-1" /> Add your first milestone
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {milestones.map(m => (
          <div key={m.id} className="border rounded-lg overflow-hidden">
            {/* Milestone header row */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 select-none"
              onClick={() => toggleExpand(m.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {expanded.has(m.id)
                  ? <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                  : <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
                <span className="font-medium text-sm truncate">{m.milestone_name}</span>
                <StatusBadge status={m.status} />
                {m.priority !== null && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">P{m.priority}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {fmtDate(m.start_date)} → {fmtDate(m.end_date)}
                </span>
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEdit(m)}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMilestone(m.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Expanded: tasks */}
            {expanded.has(m.id) && (
              <div className="border-t px-4 py-3">
                {m.description && (
                  <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tasks ({m.tasks?.length ?? 0})
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => setTaskModal({ milestoneId: m.id, task: null })}
                    >
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
                  <div className="space-y-1.5">
                    {m.tasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md border bg-background hover:bg-muted/20 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{t.task_name}</span>
                          <StatusBadge status={t.status} />
                          {t.priority !== null && (
                            <span className="text-xs font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">P{t.priority}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="hidden sm:block text-xs text-muted-foreground">
                            {fmtDate(t.start_date)} → {fmtDate(t.end_date)}
                          </span>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setTaskModal({ milestoneId: m.id, task: t })}
                            >
                              <Pencil size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

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
