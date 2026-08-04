// =============================================================
//  CONTENIDO OPERATIVO EDITABLE (Fase 2 · Entrega 1)
//  spec 2026-08-01-contenido-operativo-editable
//  Una fila por entrada; la estructura por tipo vive en `datos` (jsonb).
//  Historial: [{ ts, autor, campo, de, a }] — se arma aquí al editar.
// =============================================================
import { supabase } from './supabaseClient.js';

function requiereSupabase(){
  if (!supabase) throw new Error('Supabase no está configurado');
}

// Lista TODO el contenido (activo e inactivo — el filtro es de la UI).
export async function listarContenido(){
  requiereSupabase();
  const { data, error } = await supabase
    .from('contenido')
    .select('id, tipo, titulo, datos, activo, orden, actualizado_por, actualizado_en, historial, usuarios(alias)')
    .order('tipo').order('orden', { ascending: true, nullsFirst: false });
  if (error) throw new Error('No se pudo leer el contenido: ' + error.message);
  return (data || []).map(r => ({ ...r, actualizadoAlias: r.usuarios?.alias || '' }));
}

export async function crearContenido(tipo, titulo, datos, usuario, orden){
  requiereSupabase();
  const { data, error } = await supabase.from('contenido').insert({
    tipo, titulo, datos, orden: orden ?? null,
    actualizado_por: usuario?.id || null,
    historial: [{ ts: new Date().toISOString(), autor: usuario?.alias || '', campo: '(creación)', de: null, a: titulo }]
  }).select('id').single();
  if (error) throw new Error('No se pudo crear la entrada: ' + error.message);
  return data.id;
}

// Edita `datos` completos; calcula el diff campo a campo para el historial.
export async function editarContenido(entrada, datosNuevos, tituloNuevo, usuario){
  requiereSupabase();
  const cambios = [];
  const claves = new Set([...Object.keys(entrada.datos || {}), ...Object.keys(datosNuevos || {})]);
  claves.forEach(k => {
    const de = entrada.datos?.[k], a = datosNuevos?.[k];
    if (JSON.stringify(de) !== JSON.stringify(a))
      cambios.push({ ts: new Date().toISOString(), autor: usuario?.alias || '', campo: k, de: de ?? null, a: a ?? null });
  });
  if (!cambios.length && tituloNuevo === entrada.titulo) return entrada;   // nada que guardar
  const { data, error } = await supabase.from('contenido').update({
    titulo: tituloNuevo || entrada.titulo,
    datos: datosNuevos,
    actualizado_por: usuario?.id || null,
    actualizado_en: new Date().toISOString(),
    historial: [...(entrada.historial || []), ...cambios]
  }).eq('id', entrada.id).select('id').single();
  if (error) throw new Error('No se pudo guardar la edición: ' + error.message);
  return data;
}

export async function activarContenido(entrada, activo, usuario){
  requiereSupabase();
  const { error } = await supabase.from('contenido').update({
    activo,
    actualizado_por: usuario?.id || null,
    actualizado_en: new Date().toISOString(),
    historial: [...(entrada.historial || []), { ts: new Date().toISOString(), autor: usuario?.alias || '', campo: 'activo', de: entrada.activo, a: activo }]
  }).eq('id', entrada.id);
  if (error) throw new Error('No se pudo cambiar el estado: ' + error.message);
}

// Borrado definitivo — la RLS solo se lo permite al administrador.
export async function eliminarContenido(id){
  requiereSupabase();
  const { error } = await supabase.from('contenido').delete().eq('id', id);
  if (error) throw new Error('No se pudo eliminar: ' + error.message);
}

// ---------------------------------------------------------------
//  Adaptadores fila → estructuras que la UI histórica espera
//  (mismas formas que el seed de data.js; DATA queda de respaldo).
// ---------------------------------------------------------------
export function contenidoADATA(filas){
  const act = filas.filter(f => f.activo);
  const de = tipo => act.filter(f => f.tipo === tipo).sort((a, b) => (a.orden ?? 9e9) - (b.orden ?? 9e9));
  const out = {};
  out.campanias = de('campania').map(f => f.datos);
  out.extensiones = de('extension').map(f => f.datos);
  out.vip = de('vip').map(f => f.datos);
  out.conocimiento = de('conocimiento').map(f => f.datos);
  // escalamiento: filas planas → [{grupo, items}] conservando el orden
  const grupos = [];
  de('escalamiento').forEach(f => {
    let g = grupos.find(x => x.grupo === f.datos.grupo);
    if (!g) { g = { grupo: f.datos.grupo, items: [] }; grupos.push(g); }
    const { grupo, ...persona } = f.datos;
    g.items.push(persona);
  });
  out.escalamiento = grupos;
  // pico y placa: filas por ciudad → objeto {ciudad: {...}}
  const pp = {};
  de('pico_placa').forEach(f => { const { ciudad, ...resto } = f.datos; pp[ciudad || f.titulo] = resto; });
  out.picoPlaca = pp;
  // directorio telefónico Armotor (plano, con ciudad; la UI agrupa por sede)
  out.directorio = de('directorio').map(f => f.datos);
  return out;
}
