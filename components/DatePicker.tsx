'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  autoOpen?: boolean
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, autoOpen }: DatePickerProps) {
  const [open, setOpen] = useState(autoOpen ?? false)
  const date = value ? parseISO(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-start rounded-md border border-input bg-background px-3 py-1.5 text-sm font-normal transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !date && 'text-muted-foreground',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, 'dd MMM yyyy') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d: Date | undefined) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : null)
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
