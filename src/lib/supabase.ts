import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy client if env vars are missing (for build time)
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Placeholder for build time - will be replaced at runtime
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  if (typeof window !== 'undefined') {
    console.warn('Supabase environment variables not configured');
  }
}

export { supabase };

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  rank?: string;
  status: 'pending' | 'approved';
  created_at?: string;
  approved_at?: string;
};

export type Flight = {
  id: string;
  user_id: string;
  date: string;
  flight_number: string;
  departure: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  aircraft: string;
  co_pilot?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at?: string;
};
