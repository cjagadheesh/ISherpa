import { API_URL } from './config';
import { supabase } from './supabase';

export async function apiFetch(path, options = {}) {
  let token = 'demo-token';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
    }
  } catch (err) {
    console.warn('Supabase session lookup fallback:', err);
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
