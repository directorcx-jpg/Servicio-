// =============================================================
//  COTIZADOR — precios, horas y combos sincronizados desde el libro de
//  Drive vía Supabase (piloto #27). La Edge Function sincronizar-cotizador
//  escribe cada noche (9:00 pm) o bajo demanda; aquí solo se lee.
// =============================================================
import { supabase } from './supabaseClient.js';

function requiereSupabase(){
  if (!supabase) throw new Error('Supabase no está configurado');
}

// Devuelve las estructuras que el cotizador del panel ya consume:
//   precios        {modelo: [[servicio, mo, rep, kit], ...]}
//   horasKit       {modelo: {servicio: horas}}
//   alineacionHoras{modelo: horas}
//   combos         [['Ninguno', 0], [nombre, valor], ...]
//   ultimaSync     {ejecutado_en, precios_cambiados, horas_cambiadas, error}
export async function cargarCotizadorSupabase(){
  requiereSupabase();
  const [p, m, c, l] = await Promise.all([
    supabase.from('cotizador_precios').select('modelo, servicio, mo, rep, kit, horas').order('modelo').order('servicio'),
    supabase.from('cotizador_modelos').select('modelo, alineacion_horas'),
    supabase.from('cotizador_combos').select('nombre, valor').order('orden'),
    supabase.from('cotizador_sync_log').select('ejecutado_en, origen, kits, precios_cambiados, horas_cambiadas, error').order('ejecutado_en', { ascending: false }).limit(1)
  ]);
  for (const r of [p, m, c, l]) if (r.error) throw new Error('No se pudo leer el cotizador: ' + r.error.message);
  if (!p.data || !p.data.length) return null;   // sin sincronizar aún → seed

  const precios = {}, horasKit = {};
  p.data.forEach(r => {
    (precios[r.modelo] = precios[r.modelo] || []).push([r.servicio, r.mo, r.rep, r.kit || '']);
    if (r.horas != null) (horasKit[r.modelo] = horasKit[r.modelo] || {})[r.servicio] = Number(r.horas);
  });
  const alineacionHoras = {};
  (m.data || []).forEach(r => { alineacionHoras[r.modelo] = Number(r.alineacion_horas); });
  const combos = [['Ninguno', 0], ...(c.data || []).map(r => [r.nombre, r.valor])];
  return { precios, horasKit, alineacionHoras, combos, ultimaSync: (l.data || [])[0] || null };
}

// Pide una sincronización inmediata (solo coordinador/admin; el secreto
// vive en el servidor). Devuelve el id de la petición HTTP encolada.
export async function solicitarSyncCotizador(){
  requiereSupabase();
  const { data, error } = await supabase.rpc('solicitar_sync_cotizador');
  if (error) throw new Error(error.message);
  return data;
}

export async function ultimaSyncCotizador(){
  requiereSupabase();
  const { data, error } = await supabase.from('cotizador_sync_log')
    .select('ejecutado_en, origen, kits, kits_nuevos, precios_cambiados, horas_cambiadas, modelos, combos, error')
    .order('ejecutado_en', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
