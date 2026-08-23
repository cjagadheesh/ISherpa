const configuredApiUrl = import.meta.env.VITE_API_URL;

export const API_URL = (configuredApiUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
