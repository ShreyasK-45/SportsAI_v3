import { createClient } from '@supabase/supabase-js'

// ─── Replace these with your actual project values ──────────────────────────
// 1. Go to https://supabase.com → your project → Settings → API
// 2. Copy "Project URL" and "anon public" key and paste below
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  ?? 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON ?? 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export const isConfigured =
  SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co' &&
  SUPABASE_ANON !== 'YOUR_ANON_KEY'
