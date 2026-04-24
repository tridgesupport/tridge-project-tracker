'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task, User, TaskStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/DatePicker'
import { toast } from 'sonner'

const TASK_STATUSES: TaskStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed',
]

interface TaskModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  milestoneId: string
  projectId: string
  task?: Task | null
  internalUsers: User[]
  currentUser: User
  projectName: string
}

const NONE = '__none__'

export function TaskModal({
  open, onClose, onSaved, milestoneId, projectId, task, internalUsers, currentUser, projectName,
}: TaskModalProps) {
  const supabase = createClient()
  const isNew = !task

  const [form, setForm] = useState({
    task_name: '',
    description: '',
    comments: '',
    links: '',
    documentation_link: '',
    start_date: null as string | null,
    end_date: null as string | null,
    status: 'Pending' as TaskStatus,
    assigned_to: null as string | null,
    next_action_by: null as string | null,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({
        task_name: task.task_name,
        description: task.description || '',
        comments: task.comments || '',
        links: task.links || '',
        documentation_link: task.documentation_link || '',
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status,
        assigned_to: task.assigned_to,
        next_action_by: task.next_action_by,
      })
    } else {
      setForm({
        task_name: '', description: '', comments: '', links: '', documentation_link: '',
        start_date: null, end_date: null, status: 'Pending', assigned_to: null, next_action_by: null,
      })
    }
  }, [task, open])

  async function handleSave() {
    if (!form.task_name.trim()) { toast.error('Task name is required'); return }
    setSaving(true)

    const payload = {
      ...form,
      milestone_id: milestoneId,
      project_id: projectId,
      last_edited_by: currentUser.id,
      last_edited_at: new Date().toISOString(),
    }

    let savedId = task?.id
    let oldNextAction = task?.next_action_by

    if (isNew) {
      const { data, error } = await supabase.from('tasks').insert(payload).select().single()
      if (error) {
        console.error('Task insert error:', error)
        toast.error('Failed to create task: ' + error.message)
        setSaving(false)
        return
      }
      savedId = data.id
    } else {
      const changes: Record<string, { old: unknown; new: unknown }> = {}
      const fields = Object.keys(form) as (keyof typeof form)[]
      for (const f of fields) {
        const oldVal = task?.[f as keyof Task]
        if (oldVal !== form[f]) changes[f] = { old: oldVal, new: form[f] }
      }

      const { error } = await supabase.from('tasks').update(payload).eq('id', task!.id)
      if (error) {
        console.error('Task update error:', error)
        toast.error('Failed to save task: ' + error.message)
        setSaving(false)
        return
      }

      if (Object.keys(changes).length > 0) {
        const { error: logErr } = await supabase.from('edit_log').insert({
          entity_type: 'task',
          entity_id: task!.id,
          edited_by_email: currentUser.email,
          edited_at: new Date().toISOString(),
          changes,
        })
        if (logErr) console.error('Edit log error:', logErr)
      }
    }

    // Email notification if next_action_by changed
    if (form.next_action_by && form.next_action_by !== oldNextAction) {
      const assignee = internalUsers.find(u => u.id === form.next_action_by)
      if (assignee) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: assignee.email,
            toName: assignee.name,
            entityType: 'Task',
            entityName: form.task_name,
            projectName,
            appUrl: `${window.location.origin}/projects/${projectId}`,
          }),
        }).catch(() => {})
      }
    }

    toast.success(isNew ? 'Task created' : 'Task saved')
    setSaving(false)
    onSaved()
    onClose()
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Task' : 'Edit Task'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Task Name *</Label>
            <Input value={form.task_name} onChange={e => set('task_name', e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Comments</Label>
            <Textarea value={form.comments} onChange={e => set('comments', e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Links</Label>
            <Input value={form.links} onChange={e => set('links', e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Documentation Link</Label>
            <Input value={form.documentation_link} onChange={e => set('documentation_link', e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Start Date</Label>
            <DatePicker value={form.start_date} onChange={v => set('start_date', v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>End Date</Label>
            <DatePicker value={form.end_date} onChange={v => set('end_date', v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: string | null) => { if (v) set('status', v) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Assigned To</Label>
            <Select value={form.assigned_to ?? NONE} onValueChange={(v: string | null) => set('assigned_to', (!v || v === NONE) ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Next Action By</Label>
            <Select value={form.next_action_by ?? NONE} onValueChange={(v: string | null) => set('next_action_by', (!v || v === NONE) ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
