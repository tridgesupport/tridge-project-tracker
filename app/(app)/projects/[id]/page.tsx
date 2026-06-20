'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Project, User, Client, Milestone, EditLog, ProjectStatus, ProjectType } from '@/types'
import { getProject, getClients, getUsers, getMilestones, getEditLog, createProject, updateProject, appendEditLog } from '@/lib/api'
import { StatusBadge } from '@/components/StatusBadge'
import { MilestoneSection } from '@/components/milestones/MilestoneSection'
import { DatePicker } from '@/components/DatePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PROJECT_STATUSES: ProjectStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed', 'Scoping',
]
const PROJECT_TYPES: ProjectType[] = ['Internal R&D', 'Existing Client', 'Potential Client']
const NONE = '__none__'
const PRIORITY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

function fmtDatetime(d: string) {
  try { return format(parseISO(d), 'dd MMM yy, HH:mm') } catch { return d }
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const isNew = id === 'new'
  const milestoneRef = useRef<HTMLDivElement>(null)

  const profile = session?.user ? {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    role: (session.user as unknown as Record<string, string>).role || 'internal',
    team: (session.user as unknown as Record<string, string>).team || 'internal',
    created_at: '',
  } as User : null

  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [internalUsers, setInternalUsers] = useState<User[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [editLog, setEditLog] = useState<EditLog[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    project_name: '',
    description: '',
    expected_start_date: null as string | null,
    expected_end_date: null as string | null,
    status: 'Pending' as ProjectStatus,
    owner_id: null as string | null,
    project_type: 'Internal R&D' as ProjectType,
    customer_id: null as string | null,
    next_action_by: null as string | null,
    priority: null as number | null,
  })

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const [cls, usrs] = await Promise.all([getClients(), getUsers()])
        setClients(cls)
        setInternalUsers(usrs.filter(u => u.role === 'admin' || u.role === 'internal'))

        if (!isNew) {
          const [proj, mils, log] = await Promise.all([
            getProject(id),
            getMilestones(id),
            getEditLog(id, 'project'),
          ])
          setProject(proj)
          setForm({
            project_name: proj.project_name,
            description: proj.description ?? '',
            expected_start_date: proj.expected_start_date,
            expected_end_date: proj.expected_end_date,
            status: proj.status,
            owner_id: proj.owner_id,
            project_type: proj.project_type,
            customer_id: proj.customer_id,
            next_action_by: proj.next_action_by,
            priority: proj.priority ?? null,
          })
          setMilestones(mils)
          setEditLog(log)
        }
      } catch (err) {
        toast.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function loadMilestones() {
    const mils = await getMilestones(id)
    setMilestones(mils)
  }

  async function handleSave() {
    if (!form.project_name.trim()) { toast.error('Project name is required'); return }
    if (!profile) { toast.error('Session error — please refresh'); return }
    setSaving(true)

    const payload = {
      ...form,
      description: form.description || null,
      last_edited_by: profile.id,
      last_edited_at: new Date().toISOString(),
    }

    try {
      if (isNew) {
        const data = await createProject(payload)
        toast.success('Project created! Scroll down to add milestones.')
        router.push(`/projects/${data.id}`)
      } else {
        const changes: Record<string, { old: unknown; new: unknown }> = {}
        const keys = Object.keys(form) as (keyof typeof form)[]
        for (const k of keys) {
          const oldVal = project?.[k as keyof Project]
          if (oldVal !== (form as Record<string, unknown>)[k]) {
            changes[k] = { old: oldVal, new: (form as Record<string, unknown>)[k] }
          }
        }

        await updateProject(id, {
          ...payload,
          _changes: changes,
          _editedByEmail: profile.email,
          _notifyEmail: form.next_action_by && form.next_action_by !== project?.next_action_by
            ? internalUsers.find(u => u.id === form.next_action_by)?.email || null
            : null,
          _notifyName: form.next_action_by && form.next_action_by !== project?.next_action_by
            ? internalUsers.find(u => u.id === form.next_action_by)?.name || null
            : null,
          _projectName: form.project_name,
        })

        toast.success('Project saved')
        setProject(p => ({ ...p!, ...payload }))
        const log = await getEditLog(id, 'project')
        setEditLog(log)
      }
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const canEdit = profile?.role === 'admin' || profile?.role === 'internal'

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>

  if (!profile) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <p className="text-sm text-destructive font-medium mb-2">Session not found.</p>
        <p className="text-xs text-muted-foreground">Please sign in to continue.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-xl font-semibold">
          {isNew ? 'New Project' : form.project_name || 'Project'}
        </h1>
        {!isNew && project && <StatusBadge status={project.status} />}
      </div>

      <div className="bg-background border rounded-xl p-6 mb-6">
        <h2 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">
          Project Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Project Name *</Label>
            <Input value={form.project_name} onChange={e => set('project_name', e.target.value)}
              disabled={!canEdit} placeholder="e.g. Q2 Market Research" />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Project Type</Label>
            <Select value={form.project_type}
              onValueChange={(v: string | null) => { if (v) set('project_type', v) }} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={form.status}
              onValueChange={(v: string | null) => { if (v) set('status', v) }} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id ?? NONE}
              onValueChange={(v: string | null) => set('customer_id', (!v || v === NONE) ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_id ?? NONE}
              onValueChange={(v: string | null) => set('owner_id', (!v || v === NONE) ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Expected Start</Label>
            <DatePicker value={form.expected_start_date}
              onChange={v => set('expected_start_date', v)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Expected End</Label>
            <DatePicker value={form.expected_end_date}
              onChange={v => set('expected_end_date', v)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Next Action By</Label>
            <Select value={form.next_action_by ?? NONE}
              onValueChange={(v: string | null) => set('next_action_by', (!v || v === NONE) ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select value={form.priority !== null ? String(form.priority) : NONE}
              onValueChange={(v: string | null) => set('priority', (!v || v === NONE) ? null : Number(v))} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {PRIORITY_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end mt-5">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {!isNew && profile && (
        <div ref={milestoneRef} className="bg-background border rounded-xl p-6 mb-6">
          <MilestoneSection
            projectId={id}
            projectName={form.project_name}
            milestones={milestones}
            internalUsers={internalUsers}
            currentUser={profile}
            canEdit={canEdit}
            onRefresh={loadMilestones}
          />
        </div>
      )}

      {!isNew && (
        <div className="bg-background border rounded-xl overflow-hidden mb-6">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30"
            onClick={() => setLogOpen(o => !o)}
          >
            <span>Audit Log ({editLog.length})</span>
            {logOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {logOpen && (
            <div className="px-6 pb-4">
              <Separator className="mb-4" />
              {editLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No edits recorded.</p>
              ) : (
                <div className="space-y-3">
                  {editLog.map(log => (
                    <div key={log.id} className="text-sm border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{log.edited_by_email}</span>
                        <span className="text-xs text-muted-foreground">{fmtDatetime(log.edited_at)}</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(log.changes).map(([field, diff]) => (
                          <div key={field} className="text-xs text-muted-foreground">
                            <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>:{' '}
                            <span className="line-through text-red-500">{String(diff.old ?? '—')}</span>
                            {' → '}
                            <span className="text-green-600">{String(diff.new ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
