// src/lib/auth.js
// Autenticación con Google Workspace SSO vía Supabase Auth.
// Reemplaza por completo el login por PIN. Solo correos @armotor.com
// autorizados en public.usuarios pueden entrar a la app.

import { supabase } from './supabaseClient.js';

// Dispara el flujo OAuth con Google. Al volver, Supabase deja la sesión
// en la misma URL de la app (redirectTo = origin + pathname, sin query/hash).
export function signInWithGoogle() {
  if (!supabase) {
    console.error('[Auth] Supabase no inicializado. Revisa los meta tags.');
    return Promise.resolve({ error: new Error('Supabase deshabilitado') });
  }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

// Cierra la sesión de Supabase, limpia el estado local y recarga la página.
export async function signOut() {
  try { if (supabase) await supabase.auth.signOut(); }
  catch (e) { console.warn('[Auth] Error al cerrar sesión', e); }
  try { localStorage.clear(); } catch {}
  window.location.reload();
}

// Devuelve la sesión actual: { data: { session }, error }.
export function getCurrentSession() {
  if (!supabase) return Promise.resolve({ data: { session: null }, error: null });
  return supabase.auth.getSession();
}

// Carga el perfil de public.usuarios por id (UUID enlazado a auth.users).
// Devuelve { id, email, nombre, alias, rol, sede_asignada, activo } o null.
export async function loadUserProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, alias, rol, sede_asignada, activo')
    .eq('id', userId)
    .maybeSingle();
  if (error) { console.error('[Auth] loadUserProfile', error); return null; }
  return data || null;
}

// Expone el listener de cambios de auth de Supabase para que app.js reaccione
// a login/logout en tiempo real. El callback recibe (event, session).
export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: null } };
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}
