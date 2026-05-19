export type UserRole = 'admin' | 'internal' | 'client'
export type UserTeam = 'internal' | 'client'

export type ProjectStatus =
  | 'Pending'
  | 'In Progress'
  | 'Sent for Review'
  | 'Sent for Correction'
  | 'Completed'
  | 'Scoping'

export type MilestoneStatus =
  | 'Pending'
  | 'In Progress'
  | 'Sent for Review'
  | 'Sent for Correction'
  | 'Completed'

export type TaskStatus =
  | 'Pending'
  | 'In Progress'
  | 'Sent for Review'
  | 'Sent for Correction'
  | 'Completed'

export type ProjectType = 'Internal R&D' | 'Existing Client' | 'Potential Client'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  team: UserTeam
  created_at: string
}

export interface Client {
  id: string
  name: string
  contact: string
  email: string
  created_at: string
}

export interface Project {
  id: string
  project_name: string
  description: string | null
  expected_start_date: string | null
  expected_end_date: string | null
  status: ProjectStatus
  owner_id: string | null
  project_type: ProjectType
  customer_id: string | null
  next_action_by: string | null
  last_edited_by: string | null
  last_edited_at: string | null
  created_at: string
  priority: number | null
  owner?: User
  customer?: Client
  next_action_by_user?: User
  last_edited_by_user?: User
}

export interface Milestone {
  id: string
  project_id: string
  milestone_name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: MilestoneStatus
  assigned_to: string | null
  next_action_by: string | null
  last_edited_by: string | null
  last_edited_at: string | null
  created_at: string
  priority: number | null
  assigned_to_user?: User
  next_action_by_user?: User
  tasks?: Task[]
}

export interface Task {
  id: string
  milestone_id: string
  project_id: string
  task_name: string
  description: string | null
  comments: string | null
  links: string | null
  documentation_link: string | null
  start_date: string | null
  end_date: string | null
  status: TaskStatus
  assigned_to: string | null
  next_action_by: string | null
  last_edited_by: string | null
  last_edited_at: string | null
  created_at: string
  priority: number | null
  assigned_to_user?: User
  next_action_by_user?: User
}

export interface Comment {
  id: string
  entity_type: 'milestone' | 'task'
  entity_id: string
  author_id: string | null
  content: string
  created_at: string
  author?: User | null
}

export interface EditLog {
  id: string
  entity_type: 'project' | 'milestone' | 'task'
  entity_id: string
  edited_by_email: string
  edited_at: string
  changes: Record<string, { old: unknown; new: unknown }>
}
