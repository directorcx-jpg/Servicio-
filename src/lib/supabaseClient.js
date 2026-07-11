// src/lib/supabaseClient.js
// Cliente Supabase para Armotor CETA
// Capa paralela a apiCall (Apps Script). Migración gradual endpoint por endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Las credenciales viajan en meta tags del HTML porque este proyecto
// no tiene bundler y no puede leer .env.local directamente.
const getMeta = (name) => {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute('content') : null;
};

const SUPABASE_URL = getMeta('supabase-url');
const SUPABASE_ANON_KEY = getMeta('supabase-anon-key');

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!supabaseEnabled) {
  console.warn('[Supabase] Deshabilitado. Faltan meta tags supabase-url y/o supabase-anon-key en index.');
}

export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Prueba de humo — expone en window solo para debug rápido en consola.
// Quitar después de estabilizar la migración.
if (supabase) {
  window.__supabase = supabase;
  console.log('[Supabase] Cliente inicializado');
}
