// Supabase removed — using Neon + NextAuth
export async function createServerSupabaseClient() {
  throw new Error('Supabase has been removed. Use lib/db.ts or auth() from NextAuth instead.')
}
