
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  console.log('Current VITE_SUPABASE_URL:', supabaseUrl);
}

// Fallback to a valid placeholder to avoid "Invalid URL" TypeError, 
// though fetches will still fail (with 404 or CORS issues).
const finalUrl = supabaseUrl || 'https://missing-supabase-url.supabase.co';
const finalKey = supabaseAnonKey || 'missing-key';

/**
 * Global Supabase client instance.
 * Persistent session enabled for PWA functionality.
 */
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'madrasah_auth_token',
    flowType: 'pkce',
    lock: async (_name: string, _acquireTimeout: number, acquire: () => Promise<any>) => {
      return await acquire();
    }
  }
});
