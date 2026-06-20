import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      team: string
    } & DefaultSession['user']
  }
  interface User {
    role?: string
    team?: string
  }
}
