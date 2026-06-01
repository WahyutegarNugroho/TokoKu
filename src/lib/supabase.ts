import { createBrowserClient } from '@supabase/ssr';

/**
 * Client-side Supabase client using @supabase/ssr for cookie-based auth.
 * Stores session tokens in cookies (not localStorage) so that the server-side
 * middleware (proxy.ts) can verify authentication on every request.
 *
 * For server-side operations, see src/lib/supabase-server.ts which uses
 * createServerClient from @supabase/ssr with the same cookie format.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key in environment variables.');
}

const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: typeof window !== 'undefined' ? navigator.onLine : true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url, options) => {
      try {
        return await fetch(url, options);
      } catch (err) {
        // Intercept failed fetches to prevent uncaught network exceptions
        if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('fetch failed') || (err as { code?: string })?.code === 'ENOTFOUND')) {
          console.warn('Supabase fetch failed (network offline):', err.message);
          return new Response(JSON.stringify({ error: { message: 'Network offline', code: 'OFFLINE' } }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw err;
      }
    }
  }
});

export const supabase = supabaseClient;

