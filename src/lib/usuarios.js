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

// Usuarios que OPERAN casos internos (lista de asignación/reasignación):
// asesor_cc + coordinador + analista + administrador, activos. Se lee de
// public.usuarios porque ahí vive el uuid (usuarios_autorizados no tiene id;
// el uuid nace con el primer login vía trigger). asesor_digital NO aparece.
// Lanza Error si la consulta falla (no devuelve vacío silencioso, para que
// el llamador distinga "sin permisos / sin conexión" de "lista vacía real").
export async function listarOperadoresCasos() {
  if (!supabase) throw new Error('Supabase no está configurado');
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, alias, rol, sede_asignada')
    .in('rol', ['asesor_cc', 'coordinador', 'analista', 'administrador'])
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw new Error('No se pudo leer la lista de usuarios: ' + error.message);
  return data || [];
}
