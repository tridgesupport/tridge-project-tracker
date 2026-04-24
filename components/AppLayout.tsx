'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { User } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, FolderKanban, Users, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/clients', label: 'Clients', icon: Users },
]

const adminNavItems = [
  { href: '/admin', label: 'Admin', icon: Settings },
]

function NavLinks({ role, pathname, onClick }: { role: string; pathname: string; onClick?: () => void }) {
  const items = role === 'admin' ? [...navItems, ...adminNavItems] : navItems
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
    }
    loadProfile()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    internal: 'bg-blue-100 text-blue-700',
    client: 'bg-green-100 text-green-700',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-background p-4 gap-6">
        <div className="font-bold text-lg text-primary">Tridge Tracker</div>
        {profile && <NavLinks role={profile.role} pathname={pathname} />}
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top nav */}
        <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={(open: boolean) => setMobileOpen(open)}>
              <SheetTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                <Menu size={20} />
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-4 flex flex-col gap-6">
                <div className="font-bold text-lg text-primary">Tridge Tracker</div>
                {profile && (
                  <NavLinks role={profile.role} pathname={pathname} onClick={() => setMobileOpen(false)} />
                )}
              </SheetContent>
            </Sheet>
          </div>
          <div className="md:hidden font-semibold text-sm">Tridge Tracker</div>
          <div className="flex items-center gap-3 ml-auto">
            {profile && (
              <>
                <span className="hidden sm:block text-sm text-muted-foreground">{profile.name}</span>
                <Badge className={cn('text-xs capitalize', roleColors[profile.role] || '')}>
                  {profile.role}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full cursor-pointer outline-none">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {profile.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 gap-2 cursor-pointer">
                      <LogOut size={14} /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
