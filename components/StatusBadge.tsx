import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  'Pending': 'bg-gray-100 text-gray-700 border-gray-200',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'Sent for Review': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Sent for Correction': 'bg-orange-100 text-orange-700 border-orange-200',
  'Completed': 'bg-green-100 text-green-700 border-green-200',
  'Scoping': 'bg-purple-100 text-purple-700 border-purple-200',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', statusColors[status] || 'bg-gray-100 text-gray-700')}
    >
      {status}
    </Badge>
  )
}
