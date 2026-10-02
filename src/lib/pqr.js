// src/lib/pqr.js
// PQR de Habeas Data (spec 2026-10-01-pqr-habeas-data): registro desde el
// panel de cierre, lista de pendientes para Control y respuesta al titular.
// El exporte al sheet del área de datos NO pasa por aquí (Edge Function
// exportar-pqr con secreto, leída por el Apps Script del sheet).

import { supabase } from './supabaseClient.js';

function requiere(){
  if (!supabase) throw new Error('Supabase no está configurado');
}

// Crea la PQR ligada a la gestión recién guardada. Snapshot del titular en
// la propia fila (el sheet necesita los datos como estaban al radicar).
export async function guardarPqr(p, gestionId, clienteId, usuario){
  requiere();
  const resuelta = p.pqrEstado === 'Resuelta en la llamada';
  const fila = {
    gestion_id: gestionId || null,
    cliente_id: clienteId || null,
    nombre: p.nombre || null,
    telefono: p.telefono || null,
    placa: (p.placa || '').toUpperCase() || null,
    correo: p.correo || null,
    causal: p.pqrCausal,
    medio: p.pqrMedio || null,
    descripcion: p.pqrDesc,
    respuesta: resuelta ? (p.pqrResp || null) : null,
    fecha_respuesta: resuelta ? new Date().toISOString() : null,
    estado: resuelta ? 'respondida' : 'pendiente',
    asesor_alias: usuario?.alias || null,
    sede: p.ciudad || null
  };
  const { data, error } = await supabase.from('pqr_habeas_data').insert(fila).select('id').single();
  if (error) throw new Error('No se pudo registrar la PQR: ' + error.message);
  return data.id;
}

// Pendientes + últimas respondidas (para el bloque de Control).
export async function listarPqr(limite){
  requiere();
  const { data, error } = await supabase.from('pqr_habeas_data')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limite || 100);
  if (error) throw new Error('No se pudieron leer las PQR: ' + error.message);
  return data || [];
}

export async function responderPqr(id, respuesta){
  requiere();
  const { error } = await supabase.from('pqr_habeas_data')
    .update({ respuesta, fecha_respuesta: new Date().toISOString(), estado: 'respondida' })
    .eq('id', id);
  if (error) throw new Error('No se pudo registrar la respuesta: ' + error.message);
}
