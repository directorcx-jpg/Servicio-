// src/lib/radicacion.js
// Configuración del formulario de radicación (spec 2026-10-24): lista de
// asesores comerciales (coordinador/administrador) y clave del enlace
// público (solo administrador). La radicación en sí pasa por la Edge
// Function radicar-caso, no por aquí.

import { supabase } from './supabaseClient.js';

function requiere(){ if (!supabase) throw new Error('Supabase no está configurado'); }

export async function listarComerciales(){
  requiere();
  const { data, error } = await supabase.from('asesores_comerciales')
    .select('id, nombre, sede, activo').order('activo', { ascending: false }).order('nombre');
  if (error) throw new Error('No se pudo leer la lista de comerciales: ' + error.message);
  return data || [];
}

export async function agregarComercial(nombre, sede){
  requiere();
  const { error } = await supabase.from('asesores_comerciales').insert({ nombre, sede });
  if (error) throw new Error('No se pudo agregar: ' + error.message);
}

export async function setComercialActivo(id, activo){
  requiere();
  const { error } = await supabase.from('asesores_comerciales').update({ activo }).eq('id', id);
  if (error) throw new Error('No se pudo actualizar: ' + error.message);
}

// null si el rol no tiene acceso (la RLS solo deja ver la clave al administrador).
export async function leerClaveRadicacion(){
  requiere();
  const { data, error } = await supabase.from('app_config').select('valor').eq('clave', 'radicacion_clave').maybeSingle();
  if (error) return null;
  return data ? data.valor : null;
}

export async function cambiarClaveRadicacion(){
  requiere();
  const nueva = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');
  const { error } = await supabase.from('app_config')
    .update({ valor: nueva, actualizado_en: new Date().toISOString() }).eq('clave', 'radicacion_clave');
  if (error) throw new Error('No se pudo cambiar la clave: ' + error.message);
  return nueva;
}
