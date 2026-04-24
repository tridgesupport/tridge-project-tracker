'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Project, User, Client, Milestone, EditLog, ProjectStatus, ProjectType } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { MilestoneSection } from '@/components/milestones/MilestoneSection'
import { DatePicker } from '@/components/DatePicker'
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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PROJECT_STATUSES: ProjectStatus[] = [
  'Pending', 'In Progress', 'Sent for Review', 'Sent for Correction', 'Completed', 'Scoping',
]
const PROJECT_TYPES: ProjectType[] = ['Internal R&D', 'Existing Client', 'Potential Client']
const NONE = '__none__'

function fmtDatetime(d: string) {
  try { return format(parseISO(d), 'dd MMM yy, HH:mm') } catch { return d }
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const isNew = id === 'new'

  const [profile, setProfile] = useState<User | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [internalUsers, setInternalUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
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
  })

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
      setAllUsers(usrs || [])
      setInternalUsers((usrs || []).filter((u: User) => u.role === 'admin' || u.role === 'internal'))

      if (!isNew) {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single()
        if (proj) {
          setProject(proj)
          setForm({
            project_name: proj.project_name,
            description: proj.description || '',
            expected_start_date: proj.expected_start_date,
            expected_end_date: proj.expected_end_date,
            status: proj.status,
            owner_id: proj.owner_id,
            project_type: proj.project_type,
            customer_id: proj.customer_id,
            next_action_by: proj.next_action_by,
          })
        }
        await loadMilestones()
        await loadEditLog()
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function loadMilestones() {
    const { data } = await supabase
      .from('milestones')
      .select(`*, tasks(*)`)
      .eq('project_id', id)
      .order('created_at')
    setMilestones(data || [])
  }

  async function loadEditLog() {
    const { data } = await supabase
      .from('edit_log')
      .select('*')
      .eq('entity_id', id)
      .eq('entity_type', 'project')
      .order('edited_at', { ascending: false })
    setEditLog(data || [])
  }

  async function handleSave() {
    if (!form.project_name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)

    const payload = {
      ...form,
      last_edited_by: profile!.id,
      last_edited_at: new Date().toISOString(),
    }

    if (isNew) {
      const { data, error } = await supabase.from('projects').insert(payload).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Project created')
      router.push(`/projects/${data.id}`)
    } else {
      const changes: Record<string, { old: unknown; new: unknown }> = {}
      const keys = Object.keys(form) as (keyof typeof form)[]
      for (const k of keys) {
        const oldVal = project?.[k as keyof Project]
        if (oldVal !== (form as any)[k]) changes[k] = { old: oldVal, new: (form as any)[k] }
      }

      const { error } = await supabase.from('projects').update(payload).eq('id', id)
      if (error) { toast.error(error.message); setSaving(false); return }

      if (Object.keys(changes).length > 0) {
        await supabase.from('edit_log').insert({
          entity_type: 'project', entity_id: id,
          edited_by_email: profile!.email, edited_at: new Date().toISOString(), changes,
        })
      }

      // email if next_action_by changed
      if (form.next_action_by && form.next_action_by !== project?.next_action_by) {
        const assignee = internalUsers.find(u => u.id === form.next_action_by)
        if (assignee) {
          fetch('/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: assignee.email, toName: assignee.name, entityType: 'Project',
              entityName: form.project_name, projectName: form.project_name,
              appUrl: `${window.location.origin}/projects/${id}`,
            }),
          }).catch(() => {})
        }
      }

      toast.success('Project saved')
      setProject({ ...project!, ...payload })
      await loadEditLog()
    }
    setSaving(false)
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const canEdit = profile?.role === 'admin' || profile?.role === 'internal'

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-xl font-semibold">{isNew ? 'New Project' : form.project_name || 'Project'}</h1>
        {!isNew && project && <StatusBadge status={project.status} />}
      </div>

      <div className="bg-background border rounded-xl p-6 mb-6">
        <h2 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Project Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Project Name *</Label>
            <Input value={form.project_name} onChange={e => set('project_name', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Project Type</Label>
            <Select value={form.project_type} onValueChange={v => set('project_type', v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id || NONE} onValueChange={v => set('customer_id', v === NONE ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_id || NONE} onValueChange={v => set('owner_id', v === NONE ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Expected Start</Label>
            <DatePicker value={form.expected_start_date} onChange={v => set('expected_start_date', v)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Expected End</Label>
            <DatePicker value={form.expected_end_date} onChange={v => set('expected_end_date', v)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Next Action By</Label>
            <Select value={form.next_action_by || NONE} onValueChange={v => set('next_action_by', v === NONE ? null : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Project'}</Button>
          </div>
        )}
      </div>

      {/* Milestones */}
      {!isNew && (
        <div className="bg-background border rounded-xl p-6 mb-6">
          <MilestoneSection
            projectId={id}
            projectName={form.project_name}
            milestones={milestones}
            internalUsers={internalUsers}
            currentUser={profile!}
            canEdit={canEdit}
            onRefresh={loadMilestones}
          />
        </div>
      )}

      {/* Audit Log */}
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
