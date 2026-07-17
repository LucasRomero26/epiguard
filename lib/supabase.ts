import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase env vars. Check .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getSupabase(), prop);
  },
});
