// src/lib/clientes.js
// Búsqueda de clientes y datos para la ficha 360 (spec 2026-07-24-vista-360-v1).
// La ficha es de SOLO consulta: siempre lee datos frescos de Supabase.

import { supabase } from './supabaseClient.js';

function requiereSupabase(){
  if (!supabase) throw new Error('Supabase no está configurado (meta tags vacíos)');
}

// Clasifica el término de búsqueda: 7+ dígitos → teléfono; si no → placa.
// Normaliza en ambos casos (mayúsculas / solo dígitos, sin espacios ni guiones).
export function clasificarTermino(t){
  const limpio = String(t || '').trim();
  const digitos = limpio.replace(/\D/g, '');
  if (digitos.length >= 7 && digitos.length >= limpio.replace(/[\s\-.]/g, '').length) {
    return { tipo: 'telefono', valor: digitos };
  }
  return { tipo: 'placa', valor: limpio.toUpperCase().replace(/[\s\-.]/g, '') };
}

// Sugerencias para el buscador (hasta 8): por placa o por teléfono.
// Devuelve [{ clienteId, nombre, telefono, placa }] — clienteId puede ser
// null si el vehículo aún no tiene cliente asociado.
export async function sugerirClientes(termino){
  requiereSupabase();
  const { tipo, valor } = clasificarTermino(termino);
  if (!valor || valor.length < 3) return [];

  if (tipo === 'placa') {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('id, placa, cliente_id, clientes(id, nombre, telefono)')
      .ilike('placa', `%${valor}%`)
      .limit(8);
    if (error) throw new Error('No se pudo buscar por placa: ' + error.message);
    return (data || []).map(v => ({
      clienteId: v.cliente_id,
      vehiculoId: v.id,
      nombre: v.clientes ? v.clientes.nombre : 'Sin cliente asociado',
      telefono: v.clientes ? v.clientes.telefono : '',
      placa: v.placa
    }));
  }

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, vehiculos(id, placa)')
    .ilike('telefono', `%${valor}%`)
    .limit(8);
  if (error) throw new Error('No se pudo buscar por teléfono: ' + error.message);
  return (data || []).map(c => ({
    clienteId: c.id,
    vehiculoId: (c.vehiculos && c.vehiculos[0]) ? c.vehiculos[0].id : null,
    nombre: c.nombre,
    telefono: c.telefono,
    placa: (c.vehiculos || []).map(v => v.placa).join(' · ')
  }));
}

// Cliente + TODOS sus vehículos (bloque 1 de la ficha).
export async function obtenerCliente(clienteId){
  requiereSupabase();
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, ciudad, fecha_nacimiento, vehiculos(id, placa, marca, modelo, combustion, km_actual)')
    .eq('id', clienteId)
    .single();
  if (error) throw new Error('No se pudo cargar el cliente: ' + error.message);
  return data;
}

// Vehículo suelto (ficha abierta desde una placa sin cliente asociado).
export async function obtenerVehiculo(vehiculoId){
  requiereSupabase();
  const { data, error } = await supabase
    .from('vehiculos')
    .select('id, placa, marca, modelo, combustion, km_actual, cliente_id')
    .eq('id', vehiculoId)
    .single();
  if (error) throw new Error('No se pudo cargar el vehículo: ' + error.message);
  return data;
}
