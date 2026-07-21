// src/lib/usuarios.js
// Lecturas de personas en Supabase: usuarios de la app (public.usuarios)
// y asesores de servicio del taller (public.asesores_taller).

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

// Asesores de servicio del TALLER (para el select de cita), con su sede.
// Fuente de verdad: public.asesores_taller, cuya sede es la FK sede_id →
// public.sedes; aquí se aplana a `sede` = ciudad ('Pereira', 'Manizales'…)
// que es lo que la UI usa para filtrar. Lanza Error explícito si falla.
export async function listarAsesoresTaller() {
  if (!supabase) throw new Error('Supabase no está configurado');
  const { data, error } = await supabase
    .from('asesores_taller')
    .select('id, nombre, sedes(ciudad)')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw new Error('No se pudo leer los asesores de taller: ' + error.message);
  return (data || []).map(a => ({ id: a.id, nombre: a.nombre, sede: a.sedes ? a.sedes.ciudad : null }));
}
