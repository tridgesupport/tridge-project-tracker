import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from './providers'
import { auth } from '@/auth'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tridge Project Tracker',
  description: 'Internal project tracking system',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en">
      <body className={`${geist.className} h-full`}>
        <Providers session={session}>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
