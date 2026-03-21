import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente para Client Components ('use client')
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

// Cliente para Server Components y Server Actions
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components de solo lectura no pueden mutar cookies
        }
      },
    },
  })
}