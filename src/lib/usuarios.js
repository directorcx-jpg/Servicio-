// src/lib/usuarios.js
// Lecturas de public.usuarios que necesita la app.

import { supabase } from './supabaseClient.js';

// Asesores de call center (rol asesor_cc) activos, ordenados por nombre.
// Reemplaza el filtro que hacía rotacionPool() sobre DATA.usuarios.
// Devuelve [{ id, nombre, alias, sede_asignada }].
// (Se incluye `alias` además de lo pedido en el plan porque la asignación
//  de casos guarda el alias del asesor —asignadoAlias/asesorCeta—.)
export async function listarAsesoresCC() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, alias, sede_asignada')
    .eq('rol', 'asesor_cc')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) { console.error('[Usuarios] listarAsesoresCC', error); return []; }
  return data || [];
}
