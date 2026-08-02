import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const secureCookie = request.nextUrl.protocol === 'https:'
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie })
  const pathname = request.nextUrl.pathname

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/invite-accept') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/forgot-password') ||
    pathname.startsWith('/api/change-password') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname.startsWith('/api/cron/') // authenticated separately via CRON_SECRET, not a session cookie

  if (isPublic) return NextResponse.next()

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
