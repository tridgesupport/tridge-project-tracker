export const dynamic = 'force-dynamic'

import AppLayout from '@/components/AppLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
