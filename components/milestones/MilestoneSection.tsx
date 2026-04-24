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
import { cn } from '@/lib/utils'

const MILESTONE_STATUSES: MilestoneStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed',
]

const NONE = '__none__'

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
  onRefresh: () => void
}

export function MilestoneSection({
  projectId, projectName, milestones, internalUsers, currentUser, canEdit, onRefresh,
}: MilestoneSectionProps) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [taskModal, setTaskModal] = useState<{ milestoneId: string; task: Task | null } | null>(null)

  const [milestoneForm, setMilestoneForm] = useState({
    milestone_name: '',
    description: '',
    start_date: null as string | null,
    end_date: null as string | null,
    status: 'Pending' as MilestoneStatus,
    assigned_to: null as string | null,
    next_action_by: null as string | null,
  })
  const [saving, setSaving] = useState(false)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startAdd() {
    setMilestoneForm({
      milestone_name: '', description: '', start_date: null, end_date: null,
      status: 'Pending', assigned_to: null, next_action_by: null,
    })
    setEditingMilestone(null)
    setAddingMilestone(true)
  }

  function startEdit(m: Milestone) {
    setMilestoneForm({
      milestone_name: m.milestone_name,
      description: m.description || '',
      start_date: m.start_date,
      end_date: m.end_date,
      status: m.status,
      assigned_to: m.assigned_to,
      next_action_by: m.next_action_by,
    })
    setEditingMilestone(m)
    setAddingMilestone(false)
  }

  function cancelForm() {
    setAddingMilestone(false)
    setEditingMilestone(null)
  }

  async function saveMilestone() {
    if (!milestoneForm.milestone_name.trim()) { toast.error('Milestone name required'); return }
    setSaving(true)

    const payload = {
      ...milestoneForm,
      project_id: projectId,
      last_edited_by: currentUser.id,
      last_edited_at: new Date().toISOString(),
    }

    if (editingMilestone) {
      const changes: Record<string, { old: unknown; new: unknown }> = {}
      const keys = Object.keys(milestoneForm) as (keyof typeof milestoneForm)[]
      for (const k of keys) {
        const oldVal = editingMilestone[k as keyof Milestone]
        if (oldVal !== milestoneForm[k]) changes[k] = { old: oldVal, new: milestoneForm[k] }
      }
      const { error } = await supabase.from('milestones').update(payload).eq('id', editingMilestone.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      if (Object.keys(changes).length > 0) {
        await supabase.from('edit_log').insert({
          entity_type: 'milestone', entity_id: editingMilestone.id,
          edited_by_email: currentUser.email, edited_at: new Date().toISOString(), changes,
        })
      }
      // email notification
      if (milestoneForm.next_action_by && milestoneForm.next_action_by !== editingMilestone.next_action_by) {
        const assignee = internalUsers.find(u => u.id === milestoneForm.next_action_by)
        if (assignee) {
          fetch('/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: assignee.email, toName: assignee.name, entityType: 'Milestone',
              entityName: milestoneForm.milestone_name, projectName,
              appUrl: `${window.location.origin}/projects/${projectId}`,
            }),
          }).catch(() => {})
        }
      }
    } else {
      const { error } = await supabase.from('milestones').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    toast.success(editingMilestone ? 'Milestone saved' : 'Milestone added')
    setSaving(false)
    cancelForm()
    onRefresh()
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Delete this milestone and all its tasks?')) return
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Milestone deleted')
    onRefresh()
  }

  const setF = (k: string, v: unknown) => setMilestoneForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Milestones</h2>
        {canEdit && !addingMilestone && !editingMilestone && (
          <Button size="sm" variant="outline" onClick={startAdd}>
            <Plus size={14} className="mr-1" /> Add Milestone
          </Button>
        )}
      </div>

      {/* Add/Edit form */}
      {(addingMilestone || editingMilestone) && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30">
          <h3 className="font-medium mb-3 text-sm">{editingMilestone ? 'Edit Milestone' : 'New Milestone'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <Label className="text-xs">Milestone Name *</Label>
              <Input value={milestoneForm.milestone_name} onChange={e => setF('milestone_name', e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={milestoneForm.description} onChange={e => setF('description', e.target.value)} rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Start Date</Label>
              <DatePicker value={milestoneForm.start_date} onChange={v => setF('start_date', v)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">End Date</Label>
              <DatePicker value={milestoneForm.end_date} onChange={v => setF('end_date', v)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Status</Label>
              <Select value={milestoneForm.status} onValueChange={v => setF('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Assigned To</Label>
              <Select value={milestoneForm.assigned_to || NONE} onValueChange={v => setF('assigned_to', v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Next Action By</Label>
              <Select value={milestoneForm.next_action_by || NONE} onValueChange={v => setF('next_action_by', v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={saveMilestone} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="outline" onClick={cancelForm}>Cancel</Button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !addingMilestone && (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {milestones.map(m => (
          <div key={m.id} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 bg-muted/10"
              onClick={() => toggleExpand(m.id)}
            >
              <div className="flex items-center gap-2">
                {expanded.has(m.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-medium text-sm">{m.milestone_name}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{fmtDate(m.start_date)} → {fmtDate(m.end_date)}</span>
                {canEdit && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(m)}>
                      <Pencil size={12} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMilestone(m.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {expanded.has(m.id) && (
              <div className="px-4 pb-4 pt-2">
                {m.description && <p className="text-sm text-muted-foreground mb-3">{m.description}</p>}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</span>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setTaskModal({ milestoneId: m.id, task: null })}>
                      <Plus size={12} className="mr-1" /> Add Task
                    </Button>
                  )}
                </div>
                {(!m.tasks || m.tasks.length === 0) ? (
                  <p className="text-xs text-muted-foreground">No tasks yet.</p>
                ) : (
                  <div className="space-y-1">
                    {m.tasks?.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md border bg-background hover:bg-muted/30 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span>{t.task_name}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</span>
                          {canEdit && (
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => setTaskModal({ milestoneId: m.id, task: t })}>
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
          open={!!taskModal}
          onClose={() => setTaskModal(null)}
          onSaved={onRefresh}
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
