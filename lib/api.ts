import type { Project, Milestone, Task, Client, User, EditLog, Comment, Invoice } from '@/types'

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const getProjects = () => apiFetch<Project[]>('/api/db/projects')
export const getProject = (id: string) => apiFetch<Project>(`/api/db/projects/${id}`)
export const createProject = (data: Record<string, unknown>) =>
  apiFetch<Project>('/api/db/projects', { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (id: string, data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>(`/api/db/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const getClients = () => apiFetch<Client[]>('/api/db/clients')
export const createClient = (data: Record<string, unknown>) =>
  apiFetch<Client>('/api/db/clients', { method: 'POST', body: JSON.stringify(data) })
export const updateClient = (id: string, data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>(`/api/db/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteClient = (id: string) =>
  apiFetch<{ ok: true }>(`/api/db/clients/${id}`, { method: 'DELETE' })

export const getUsers = () => apiFetch<User[]>('/api/db/users')
export const updateUser = (id: string, data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>(`/api/db/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const getMilestones = (projectId: string) =>
  apiFetch<Milestone[]>(`/api/db/milestones?project_id=${projectId}`)
export const createMilestone = (data: Record<string, unknown>) =>
  apiFetch<Milestone>('/api/db/milestones', { method: 'POST', body: JSON.stringify(data) })
export const updateMilestone = (id: string, data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>(`/api/db/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteMilestone = (id: string) =>
  apiFetch<{ ok: true }>(`/api/db/milestones/${id}`, { method: 'DELETE' })

export const createTask = (data: Record<string, unknown>) =>
  apiFetch<Task>('/api/db/tasks', { method: 'POST', body: JSON.stringify(data) })
export const updateTask = (id: string, data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>(`/api/db/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const getEditLog = (entityId: string, entityType: string) =>
  apiFetch<EditLog[]>(`/api/db/edit-log?entity_id=${entityId}&entity_type=${entityType}`)
export const appendEditLog = (data: Record<string, unknown>) =>
  apiFetch<{ ok: true }>('/api/db/edit-log', { method: 'POST', body: JSON.stringify(data) })

export const getComments = (entityIds: string[]) =>
  apiFetch<Comment[]>(`/api/db/comments?entity_ids=${entityIds.join(',')}`)
export const createComment = (data: Record<string, unknown>) =>
  apiFetch<Comment>('/api/db/comments', { method: 'POST', body: JSON.stringify(data) })

export const getInvoices = () => apiFetch<(Invoice & { client_name: string })[]>('/api/db/invoices')
export const resendInvoice = (clientId: string, period?: { periodMonth: number; periodYear: number }) =>
  apiFetch<{ outcome: string }>(`/api/invoices/client/${clientId}/resend`, {
    method: 'POST',
    body: JSON.stringify(period || {}),
  })

export const createInvoice = (data: {
  clientId: string
  description: string
  amount: number
  sendNow: boolean
  scheduledDate?: string
}) => apiFetch<{ outcome: string; invoiceNumber: string }>('/api/invoices', {
  method: 'POST',
  body: JSON.stringify(data),
})
export const sendInvoiceNow = (id: string) =>
  apiFetch<{ outcome: string }>(`/api/invoices/${id}/send`, { method: 'POST' })
export const cancelInvoice = (id: string) =>
  apiFetch<{ ok: true }>(`/api/invoices/${id}`, { method: 'DELETE' })
export const updateInvoicePaymentStatus = (id: string, paymentStatus: string) =>
  apiFetch<{ ok: true }>(`/api/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ payment_status: paymentStatus }),
  })
