import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }
        if (!email || !password) return null
        const rows = await sql`
          SELECT id, name, email, role, team, password_hash
          FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`
        const user = rows[0]
        if (!user || !user.password_hash) return null
        const valid = await bcrypt.compare(password, user.password_hash as string)
        if (!valid) return null
        return {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
          role: user.role as string,
          team: user.team as string,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as unknown as Record<string, unknown>).role
        token.team = (user as unknown as Record<string, unknown>).team
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as unknown as Record<string, unknown>).role = token.role
        ;(session.user as unknown as Record<string, unknown>).team = token.team
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
