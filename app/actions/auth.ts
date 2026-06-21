'use server'
import { signIn, signOut } from '@/auth'
import { AuthError } from 'next-auth'

export async function credentialsSignIn(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await signIn('credentials', { email, password, redirect: false })
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: error.type ?? 'CredentialsSignin' }
    }
    throw error
  }
}

export async function credentialsSignOut(): Promise<void> {
  await signOut({ redirect: false })
}
