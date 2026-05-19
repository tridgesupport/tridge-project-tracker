'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Comment, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { MessageCircle } from 'lucide-react'

interface CommentThreadProps {
  entityType: 'milestone' | 'task'
  entityId: string
  comments: Comment[]
  currentUser: User
  canComment: boolean
  onCommentAdded: () => Promise<void>
}

export function CommentThread({
  entityType, entityId, comments, currentUser, canComment, onCommentAdded,
}: CommentThreadProps) {
  const supabase = createClient()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = comments.filter(c => c.entity_type === entityType && c.entity_id === entityId)

  function fmtTime(d: string) {
    try { return format(parseISO(d), 'dd MMM yy, HH:mm') } catch { return d }
  }

  async function submit() {
    const content = text.trim()
    if (!content) return
    setSaving(true)
    const { error } = await supabase.from('comments').insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: currentUser.id,
      content,
    })
    if (error) { toast.error('Failed to post comment: ' + error.message); setSaving(false); return }
    setText('')
    setSaving(false)
    await onCommentAdded()
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle size={13} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Comments ({filtered.length})
        </span>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {filtered.map(c => (
            <div key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{c.author?.name ?? 'Unknown'}</span>
                <span className="text-muted-foreground text-xs">{fmtTime(c.created_at)}</span>
              </div>
              <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {canComment && (
        <div className="flex gap-2 items-end">
          <Textarea
            className="text-sm min-h-[60px] flex-1"
            placeholder="Add a comment… (Ctrl+Enter to post)"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
          <Button size="sm" onClick={submit} disabled={saving || !text.trim()}>
            {saving ? 'Posting…' : 'Post'}
          </Button>
        </div>
      )}
    </div>
  )
}
