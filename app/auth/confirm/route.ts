import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Supabase OTP verification removed. Redirect to login.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`)
}
