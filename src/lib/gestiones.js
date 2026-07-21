// src/lib/gestiones.js
// Módulo de gestiones sobre Supabase. Reemplaza a Apps Script/Google Sheets
// como fuente de verdad del módulo operativo (gestiones, casos internos,
// seguimientos). Corte duro online-first: si Supabase falla, el llamador
// conserva el borrador y muestra reintento (aquí NO se silencian errores).
//
// Convención: la UI sigue hablando su formato histórico (camelCase, valores
// de pills como 'agenda'/'seg'). Este módulo traduce en ambos sentidos:
//   payload UI → filas Supabase (al escribir)
//   filas Supabase → objeto UI (al leer, vía uiDesdeFila)
// Ninguna traducción vive en la UI.

import { supabase } from './supabaseClient.js';

// ---------------------------------------------------------------
//  Traducciones UI ⇄ enums de la base
// ---------------------------------------------------------------
const ORIGEN_A_DB = { 'Inbound':'inbound', 'Base':'base', 'Formulario':'formulario', 'Chat MTIC':'chat_mtic', 'Otros':'otros', 'Interno':'interno' };
const ORIGEN_A_UI = Object.fromEntries(Object.entries(ORIGEN_A_DB).map(([k,v]) => [v,k]));

const RESULTADO_A_DB = {
  agenda:'agendado', seg:'seguimiento', comunica:'se_comunica', noc:'no_contesta',
  sinKm:'sin_km', otroTaller:'otro_taller', actualizar:'actualizar_datos', noContactar:'no_contactar'
};
const RESULTADO_A_UI = Object.fromEntries(Object.entries(RESULTADO_A_DB).map(([k,v]) => [v,k]));

function requiereSupabase(){
  if (!supabase) throw new Error('Supabase no está configurado (meta tags vacíos)');
}
const oNull = v => (v === '' || v === undefined) ? null : v;   // '' → null (fechas/horas/enums)

// Combina fecha (YYYY-MM-DD) + hora (HH:MM) de la UI en un timestamptz ISO,
// interpretados en la hora local del navegador (Colombia). null si no hay fecha.
function tsSeguimiento(fecha, hora){
  if (!fecha) return null;
  const d = new Date(`${fecha}T${(hora && /^\d{1,2}:\d{2}/.test(hora)) ? hora : '00:00'}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Inversa: timestamptz → { segFecha:'YYYY-MM-DD', segHora:'HH:MM' } en hora
// local del navegador (lo que la UI espera en sus inputs date/time).
function descomponerSeguimiento(ts){
  if (!ts) return { segFecha: '', segHora: '' };
  const d = new Date(ts);
  if (isNaN(d.getTime())) return { segFecha: '', segHora: '' };
  const p2 = n => String(n).padStart(2, '0');
  return {
    segFecha: `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,
    segHora: `${p2(d.getHours())}:${p2(d.getMinutes())}`
  };
}

// ---------------------------------------------------------------
//  Clientes y vehículos (normalización al guardar)
// ---------------------------------------------------------------

// Solo dígitos: clave estable para el upsert por teléfono.
export function normTelefono(t){ return String(t || '').replace(/\D/g, ''); }
export function normPlaca(p){ return String(p || '').toUpperCase().replace(/\s/g, ''); }

// Upsert de cliente por teléfono. Devuelve el id (uuid).
export async function upsertCliente(datos){
  requiereSupabase();
  const telefono = normTelefono(datos.telefono);
  if (!telefono) throw new Error('El cliente no tiene teléfono (clave del upsert)');
  const fila = {
    telefono,
    nombre: datos.nombre || 'Sin nombre',
    ciudad: oNull(datos.ciudad),
    fecha_nacimiento: oNull(datos.fechaNac)
  };
  const { data, error } = await supabase
    .from('clientes')
    .upsert(fila, { onConflict: 'telefono' })
    .select('id')
    .single();
  if (error) throw new Error('No se pudo guardar el cliente: ' + error.message);
  return data.id;
}

// Upsert de vehículo por placa. Devuelve el id (uuid).
export async function upsertVehiculo(datos, clienteId){
  requiereSupabase();
  const placa = normPlaca(datos.placa);
  if (!placa) throw new Error('El vehículo no tiene placa (clave del upsert)');
  const fila = {
    placa,
    cliente_id: clienteId || null,
    marca: oNull(datos.marca),
    modelo: oNull(datos.modelo),
    combustion: oNull(datos.combustion),
    km_actual: datos.kmActual ? parseInt(String(datos.kmActual).replace(/\D/g,''), 10) || null : null
  };
  const { data, error } = await supabase
    .from('vehiculos')
    .upsert(fila, { onConflict: 'placa' })
    .select('id')
    .single();
  if (error) throw new Error('No se pudo guardar el vehículo: ' + error.message);
  return data.id;
}

// ---------------------------------------------------------------
//  Cotizaciones
// ---------------------------------------------------------------

// Inserta la cotización de una gestión. Devuelve el id.
// `detalle` viene del payload de la UI (servicio/kmServicio/valor/etc.).
export async function crearCotizacion(detalle){
  requiereSupabase();
  const fila = {
    marca: oNull(detalle.marca),
    modelo: oNull(detalle.modelo),
    km_servicio: oNull(detalle.kmServicio),
    valor_total: detalle.valor ? Number(detalle.valor) : null,
    detalle_json: {
      servicio: detalle.servicio || '',
      alineacion: detalle.alineacion || '',
      descuento: detalle.descuento || '',
      embellecimiento: detalle.embellecimiento || ''
    }
  };
  const { data, error } = await supabase.from('cotizaciones').insert(fila).select('id').single();
  if (error) throw new Error('No se pudo guardar la cotización: ' + error.message);
  return data.id;
}

// ---------------------------------------------------------------
//  Asesor de taller: match por nombre contra asesores_taller
// ---------------------------------------------------------------
let _asesoresTallerCache = null;
// Invalida la caché del match por nombre. Llamar cuando se recargue la lista
// de asesores de taller (así un nombre recién creado matchea sin recargar).
export function refrescarAsesoresTallerCache(){ _asesoresTallerCache = null; }
async function resolverAsesorTaller(nombre){
  if (!nombre) return { id: null, nombreLibre: null };
  if (!_asesoresTallerCache) {
    const { data, error } = await supabase.from('asesores_taller').select('id, nombre').eq('activo', true);
    if (error) { console.warn('[Gestiones] No se pudo leer asesores_taller', error); _asesoresTallerCache = []; }
    else _asesoresTallerCache = data || [];
  }
  const m = _asesoresTallerCache.find(a => a.nombre.trim().toLowerCase() === String(nombre).trim().toLowerCase());
  return m ? { id: m.id, nombreLibre: null } : { id: null, nombreLibre: String(nombre).trim() };
}

// ---------------------------------------------------------------
//  Escritura principal
// ---------------------------------------------------------------

// Traduce el payload de la UI a la fila de `gestiones` (sin FKs, que se
// resuelven en guardarGestion). Exportada para reuso en casos internos.
async function filaDesdePayload(p, usuario){
  const asesor = await resolverAsesorTaller(p.asesorTaller);
  const esInterno = p.origen === 'Interno';
  const resultadoDb = esInterno && !p.resultado ? null : (RESULTADO_A_DB[p.resultado] || null);
  // comunicaObs/actualizarObs no tienen columna propia: se pliegan en observacion.
  const obsExtra = [p.comunicaObs, p.actualizarObs].filter(Boolean).join(' · ');
  return {
    // En casos internos el dueño es el asesor ASIGNADO por la rotación;
    // en gestiones normales, quien la registra.
    asesor_cc_id: p.asignadoId || usuario.id,
    sede: oNull(p.ciudad),
    origen: ORIGEN_A_DB[p.origen] || 'otros',
    motivo: oNull(p.motivo || p.servicio),
    resultado: resultadoDb,
    estado: esInterno && !resultadoDb ? 'pendiente' : 'gestionada',
    observacion: oNull([p.observacion, obsExtra].filter(Boolean).join(' · ')),
    novedad_reportada: p.novedad === 'Sí',
    novedad_descripcion: oNull(p.descNovedad),
    we_go_aplica: p.weGo === 'Sí',
    we_go_fecha: oNull(p.wgFecha), we_go_hora: oNull(p.wgHora),
    we_go_direccion: oNull(p.wgDireccion), we_go_quien_recoge: oNull(p.wgQuien),
    we_go_trayectos: oNull(p.wgTrayectos),
    telemetria_ofrecida: p.telemetria === 'Ofrecida' || p.telemetria === 'Contrata',
    telemetria_acepta: p.telemetria === 'Contrata',
    accesorios_ofrecidos: p.accesoriosOf === 'Sí',
    accesorios_detalle: oNull(p.cualesAccesorios),
    chks_taller: Array.isArray(p.validaciones) ? p.validaciones : [],
    servicios_adicionales: oNull(p.srvAdicional),
    cita_asesor_taller_id: asesor.id,
    cita_asesor_taller_nombre: asesor.nombreLibre,
    cita_fecha: oNull(p.fechaCita), cita_hora: oNull(p.horaCita),
    cita_observacion: null,
    fecha_seguimiento: tsSeguimiento(p.segFecha, p.segHora),
    seguimiento_observacion: oNull(p.segObs),
    se_comunica_sub: oNull(p.comunicaSub),
    actualizacion_motivo: oNull([p.motivoCambio, p.actualizarObs].filter(Boolean).join(' · ')),
    nota_quiter: oNull(p.notaQuiter),
    evolution_json: (p.evoEstado || p.evoCausa || p.evoMotivo || p.evoVoz)
      ? { estado: p.evoEstado || '', causa: p.evoCausa || '', motivo: p.evoMotivo || '', voz: p.evoVoz || '' }
      : null,
    historial: Array.isArray(p.historial) ? p.historial : [],
    // metadata de casos internos (null en gestiones normales)
    cola: oNull(p.cola),
    asignado_a: oNull(p.asignadoId),
    asignado_motivo: oNull(p.asignMotivo),
    radicado_por: usuario.alias || usuario.email || null,
    grupo_chat: oNull(p.grupoChat),
    nota_solicitante: oNull(p.notaSolicitante),
    tipo_radicacion: oNull(p.tipoRadicacion)
  };
}

// Orquesta el guardado completo: cliente → vehículo → cotización → gestión.
// Lanza Error en cualquier fallo (la UI conserva el borrador).
export async function guardarGestion(payload, usuario){
  requiereSupabase();
  if (!usuario || !usuario.id) throw new Error('Sin usuario autenticado');

  // FK nullable: sin teléfono no hay upsert de cliente (p. ej. casos internos
  // radicados solo con placa); sin placa no hay vehículo.
  const clienteId  = normTelefono(payload.telefono) ? await upsertCliente(payload) : null;
  const vehiculoId = normPlaca(payload.placa) ? await upsertVehiculo(payload, clienteId) : null;

  const tieneCotizacion = !!(payload.valor || payload.kmServicio);
  const cotizacionId = tieneCotizacion ? await crearCotizacion(payload) : null;

  const fila = await filaDesdePayload(payload, usuario);
  fila.cliente_id = clienteId;
  fila.vehiculo_id = vehiculoId;
  fila.cotizacion_id = cotizacionId;
  if (!Array.isArray(fila.historial) || !fila.historial.length) {
    fila.historial = [{ ts: new Date().toISOString(), tipo: 'Creado', autor: usuario.alias || '', resultado: fila.resultado || fila.estado, nota: payload.observacion || '' }];
  }

  const { data, error } = await supabase.from('gestiones').insert(fila).select(SELECT_GESTION).single();
  if (error) throw new Error('No se pudo guardar la gestión: ' + error.message);

  // Enlazar la cotización de vuelta a su gestión (columna gestion_id).
  if (cotizacionId) {
    const { error: e2 } = await supabase.from('cotizaciones').update({ gestion_id: data.id }).eq('id', cotizacionId);
    if (e2) console.warn('[Gestiones] No se pudo enlazar cotizacion.gestion_id', e2);
  }
  return uiDesdeFila(data);
}

// ---------------------------------------------------------------
//  Lectura
// ---------------------------------------------------------------
// Hint fk_gestiones_cotizacion: hay DOS relaciones entre gestiones y
// cotizaciones (gestiones.cotizacion_id y cotizaciones.gestion_id); esta es
// la de gestiones.cotizacion_id → cotizaciones.id (validada contra la BD).
const SELECT_GESTION = '*, clientes(id, nombre, telefono, ciudad, fecha_nacimiento), vehiculos(id, placa, marca, modelo, combustion, km_actual), cotizaciones!fk_gestiones_cotizacion(id, km_servicio, valor_total, detalle_json)';

// Convierte una fila de Supabase (snake_case + joins) al objeto que la UI
// histórica espera (camelCase, valores de pills). Única puerta de traducción.
export function uiDesdeFila(r){
  const cli = r.clientes || {};
  const veh = r.vehiculos || {};
  const cot = r.cotizaciones || {};
  const det = cot.detalle_json || {};
  const evo = r.evolution_json || {};
  const creado = r.creado_en ? new Date(r.creado_en).getTime() : Date.now();
  const actualizado = r.actualizado_en ? new Date(r.actualizado_en).getTime() : creado;
  return {
    id: r.id,
    // cliente/vehículo (la UI los espera planos)
    nombre: cli.nombre || '', telefono: cli.telefono || '', ciudad: r.sede || cli.ciudad || '',
    fechaNac: cli.fecha_nacimiento || '',
    placa: veh.placa || '', marca: veh.marca || '', modelo: veh.modelo || '',
    combustion: veh.combustion || '', kmActual: veh.km_actual != null ? String(veh.km_actual) : '',
    // gestión
    origen: ORIGEN_A_UI[r.origen] || r.origen || '',
    motivo: r.motivo || '', servicio: det.servicio || r.motivo || '',
    resultado: r.estado === 'pendiente' ? 'pendiente' : (RESULTADO_A_UI[r.resultado] || r.resultado || ''),
    observacion: r.observacion || '',
    novedad: r.novedad_reportada ? 'Sí' : 'No', descNovedad: r.novedad_descripcion || '',
    weGo: r.we_go_aplica ? 'Sí' : 'No', wgFecha: r.we_go_fecha || '', wgHora: r.we_go_hora || '',
    wgDireccion: r.we_go_direccion || '', wgQuien: r.we_go_quien_recoge || '', wgTrayectos: r.we_go_trayectos || '',
    telemetria: r.telemetria_acepta ? 'Contrata' : (r.telemetria_ofrecida ? 'Ofrecida' : 'No'),
    accesoriosOf: r.accesorios_ofrecidos ? 'Sí' : 'No', cualesAccesorios: r.accesorios_detalle || '',
    validaciones: r.chks_taller || [], srvAdicional: r.servicios_adicionales || '',
    asesorTaller: r.cita_asesor_taller_nombre || '',      // el nombre por FK se resuelve en la UI si hace falta
    fechaCita: r.cita_fecha || '', horaCita: r.cita_hora || '',
    ...descomponerSeguimiento(r.fecha_seguimiento), segObs: r.seguimiento_observacion || '',
    comunicaSub: r.se_comunica_sub || '',
    kmServicio: cot.km_servicio || '', valor: cot.valor_total != null ? cot.valor_total : '',
    alineacion: det.alineacion || '', descuento: det.descuento || '', embellecimiento: det.embellecimiento || '',
    notaQuiter: r.nota_quiter || '',
    evoEstado: evo.estado || '', evoCausa: evo.causa || '', evoMotivo: evo.motivo || '', evoVoz: evo.voz || '',
    historial: r.historial || [],
    // internos / propiedad
    cola: r.cola || '', asignMotivo: r.asignado_motivo || '', radicadoPor: r.radicado_por || '',
    grupoChat: r.grupo_chat || '', notaSolicitante: r.nota_solicitante || '', tipoRadicacion: r.tipo_radicacion || '',
    asignadoId: r.asignado_a || null, createdBy: r.asesor_cc_id || null,
    // alias de asesor: la UI los rellena con su caché (S.asesoresCC) si aplica
    asesorCeta: '', asignadoAlias: '', createdByAlias: '',
    _ts: creado, _updated: actualizado
  };
}

// Lista gestiones con joins, filtrable. Ordenada descendente por creación.
// filtros: { desde, hasta, sede, asesorId, estado, limite }
export async function listarGestiones(filtros){
  requiereSupabase();
  const f = filtros || {};
  let q = supabase.from('gestiones').select(SELECT_GESTION).order('creado_en', { ascending: false }).limit(f.limite || 500);
  if (f.desde)    q = q.gte('creado_en', f.desde);
  if (f.hasta)    q = q.lte('creado_en', f.hasta);
  if (f.sede)     q = q.eq('sede', f.sede);
  if (f.asesorId) q = q.eq('asesor_cc_id', f.asesorId);
  if (f.estado)   q = q.eq('estado', f.estado);
  const { data, error } = await q;
  if (error) throw new Error('No se pudieron leer las gestiones: ' + error.message);
  return (data || []).map(uiDesdeFila);
}

// Casos internos (origen interno), filtrables por estado/cola/asignado.
export async function listarCasosInternos(filtros){
  requiereSupabase();
  const f = filtros || {};
  let q = supabase.from('gestiones').select(SELECT_GESTION).eq('origen', 'interno')
    .order('creado_en', { ascending: false }).limit(f.limite || 500);
  if (f.estado)    q = q.eq('estado', f.estado);
  if (f.cola)      q = q.eq('cola', f.cola);
  if (f.asignadoA) q = q.eq('asignado_a', f.asignadoA);
  const { data, error } = await q;
  if (error) throw new Error('No se pudieron leer los casos internos: ' + error.message);
  return (data || []).map(uiDesdeFila);
}

// ---------------------------------------------------------------
//  Acciones sobre casos
// ---------------------------------------------------------------

// Lee el historial actual, agrega la entrada y actualiza.
// NO es atómico (read-modify-write); aceptable para el volumen del CETA
// (pocos usuarios, un caso lo toca una persona a la vez).
async function pushHistorial(gestionId, entrada, cambiosExtra){
  const { data: g, error: e1 } = await supabase.from('gestiones').select('historial').eq('id', gestionId).single();
  if (e1) throw new Error('No se pudo leer el caso: ' + e1.message);
  const historial = Array.isArray(g.historial) ? g.historial : [];
  historial.push(entrada);
  const { data, error } = await supabase.from('gestiones')
    .update({ ...cambiosExtra, historial })
    .eq('id', gestionId)
    .select(SELECT_GESTION)
    .single();
  if (error) throw new Error('No se pudo actualizar el caso: ' + error.message);
  return uiDesdeFila(data);
}

// Reasigna/asigna un caso a un asesor (uuid) con su motivo.
export async function asignarCaso(gestionId, asignadoA, motivo, autorAlias, asignadoAlias){
  requiereSupabase();
  return pushHistorial(gestionId, {
    ts: new Date().toISOString(), tipo: 'Reasignado', autor: autorAlias || '',
    nota: `Asignado a ${asignadoAlias || asignadoA} (${motivo || 'manual'})`
  }, { asignado_a: asignadoA, asesor_cc_id: asignadoA, asignado_motivo: motivo || 'manual' });
}

// Cierra un caso interno: estado → gestionada + resultado + notas.
export async function gestionarCaso(gestionId, resultadoUI, notas, autorAlias, cambiosExtra){
  requiereSupabase();
  const resultado = RESULTADO_A_DB[resultadoUI] || null;
  return pushHistorial(gestionId, {
    ts: new Date().toISOString(), tipo: 'Actualizado', autor: autorAlias || '',
    resultado: resultado || resultadoUI, nota: notas || ''
  }, { estado: 'gestionada', resultado, ...(cambiosExtra || {}) });
}

// Edición parcial de un caso desde el modal de detalle. Acepta un subconjunto
// de campos UI; los de cliente/vehículo (telefono, kmActual) se actualizan en
// sus tablas si la gestión tiene el FK. Si viene `resultado`, el caso queda
// gestionado (mismo comportamiento del flujo local anterior).
export async function actualizarCaso(gestionId, cambiosUI, nota, autorAlias){
  requiereSupabase();
  const c = cambiosUI || {};
  const cambios = {};
  if (c.resultado != null && c.resultado !== '' && c.resultado !== 'pendiente') {
    cambios.resultado = RESULTADO_A_DB[c.resultado] || null;
    cambios.estado = 'gestionada';
  }
  if (c.fechaCita !== undefined)  cambios.cita_fecha = oNull(c.fechaCita);
  if (c.horaCita !== undefined)   cambios.cita_hora = oNull(c.horaCita);
  if (c.observacion !== undefined) cambios.observacion = oNull(c.observacion);
  if (c.asesorTaller !== undefined) {
    const a = await resolverAsesorTaller(c.asesorTaller);
    cambios.cita_asesor_taller_id = a.id;
    cambios.cita_asesor_taller_nombre = a.nombreLibre;
  }
  // Campos que viven en cliente/vehículo
  if (c.telefono || c.kmActual) {
    const { data: g, error } = await supabase.from('gestiones').select('cliente_id, vehiculo_id').eq('id', gestionId).single();
    if (error) throw new Error('No se pudo leer el caso: ' + error.message);
    if (c.telefono && g.cliente_id) {
      const { error: e } = await supabase.from('clientes').update({ telefono: normTelefono(c.telefono) }).eq('id', g.cliente_id);
      if (e) console.warn('[Gestiones] No se pudo actualizar teléfono del cliente', e);
    }
    if (c.kmActual && g.vehiculo_id) {
      const km = parseInt(String(c.kmActual).replace(/\D/g,''), 10) || null;
      const { error: e } = await supabase.from('vehiculos').update({ km_actual: km }).eq('id', g.vehiculo_id);
      if (e) console.warn('[Gestiones] No se pudo actualizar km del vehículo', e);
    }
  }
  return pushHistorial(gestionId, {
    ts: new Date().toISOString(), tipo: 'Actualizado', autor: autorAlias || '',
    resultado: cambios.resultado || undefined, nota: nota || ''
  }, cambios);
}
