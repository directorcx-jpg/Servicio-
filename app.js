// =============================================================
//  app.js — Consola CETA Armotor  (ES Module)
//  Lógica: autenticación + roles, navegación, panel de cierre
//  unificado con estado reactivo (S), cotizador local y salidas.
// =============================================================
import { DATA } from './data.js?v=1.24.1';
import { supabaseEnabled } from './src/lib/supabaseClient.js';
import { signInWithGoogle, signOut, getCurrentSession, loadUserProfile, onAuthStateChange } from './src/lib/auth.js';
import { listarAsesoresCC, listarOperadoresCasos, listarAsesoresTaller } from './src/lib/usuarios.js';
import {
  guardarGestion as sbGuardarGestion,
  listarGestiones as sbListarGestiones,
  listarCasosInternos as sbListarCasosInternos,
  asignarCaso as sbAsignarCaso,
  gestionarCaso as sbGestionarCaso,
  listarSeguimientos as sbListarSeguimientos,
  listarGestionesDeCliente as sbListarGestionesDeCliente,
  buscarWeGoEnFranja as sbBuscarWeGoEnFranja,
  refrescarAsesoresTallerCache
} from './src/lib/gestiones.js';
import {
  sugerirClientes as sbSugerirClientes,
  obtenerCliente as sbObtenerCliente,
  obtenerVehiculo as sbObtenerVehiculo,
  fichaPorPlaca as sbFichaPorPlaca
} from './src/lib/clientes.js';
import {
  listarContenido as sbListarContenido,
  crearContenido as sbCrearContenido,
  editarContenido as sbEditarContenido,
  activarContenido as sbActivarContenido,
  eliminarContenido as sbEliminarContenido,
  contenidoADATA
} from './src/lib/contenido.js';

// ---------- Estado global (fuente única de verdad) ----------
const S = {
  user: null,                 // usuario logueado {id,email,nombre,alias,rol,sede_asignada} (id = UUID Supabase)
  asesoresCC: [],             // caché de asesores call center (Supabase) — SOLO para la rotación automática
  operadores: [],             // caché de usuarios que operan casos (cc+coordinador+analista+admin) — asignación y alias
  asesoresTaller: [],         // caché de asesores de servicio del taller ({id,nombre,sede}) — select de cita
  seguimientos: [],           // cola de seguimientos (consulta dedicada, completa — no depende del tope de la caché)
  resultado: 'agenda',
  hasNovedad: false,
  hasWG: false,
  adicionales: new Set(),
  checks: new Set(),          // botones "para el taller" arrancan apagados (punto 11)
  teleAcepta: false,          // cliente acepta contratar telemetría (punto 10)
  f: {},                      // campos data-f sincronizados
  // Estado de rotación de Casos Internos (REGLA 2/3). Persistido por día.
  // { fecha:'YYYY-MM-DD', A:{orden:[ids],pos:N}, B:{orden:[ids],pos:N} }
  colas: null,
  casoActivo: null            // id del caso interno precargado en el panel (si lo hay)
};
const CHECKS_DEF = [];   // por defecto ningún check del taller activo (punto 11)

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

// =============================================================
//  ASESORES CC (caché desde Supabase para la rotación síncrona)
// =============================================================
// La identidad la maneja Supabase Auth (ver src/lib/auth.js). Aquí solo
// cacheamos los asesores de call center para que la asignación de casos
// (asignarCaso, barajarPool, siguienteDeCola, reasignarCaso) siga siendo
// síncrona y sin llamadas a base de datos dentro de bucles.
async function cargarAsesoresCC(){
  try { S.asesoresCC = await listarAsesoresCC(); }
  catch (e) { console.error('[CETA] No se pudieron cargar los asesores CC', e); S.asesoresCC = []; }
  try { S.operadores = await listarOperadoresCasos(); }
  catch (e) { console.error('[CETA] No se pudieron cargar los operadores de casos', e); S.operadores = []; }
  try { S.asesoresTaller = await listarAsesoresTaller(); }
  catch (e) { console.error('[CETA] No se pudieron cargar los asesores de taller', e); S.asesoresTaller = []; }
}

// Resuelve una persona por su id (UUID) desde las cachés: primero operadores
// (superconjunto: cc+coordinador+analista+admin), luego asesores CC.
function asesorPorId(id){
  return (S.operadores || []).find(u => String(u.id) === String(id))
      || (S.asesoresCC || []).find(u => String(u.id) === String(id))
      || null;
}

// Pool para ASIGNAR/REASIGNAR casos internos (distinto de la rotación
// automática, que sigue siendo solo asesor_cc — ver rotacionPool()).
function poolAsignacion(){
  return S.operadores || [];
}

// =============================================================
//  AUTENTICACIÓN (Google Workspace SSO vía Supabase)
// =============================================================
const SS_AUTH_ERR = 'ceta_auth_err';   // mensaje de error que sobrevive al reload de signOut()

function mostrarLogin(){
  $('#appRoot').style.display = 'none';
  $('#loginScreen').style.display = 'flex';
}

function mostrarErrorLogin(msg){
  const err = $('#loginErr');
  if (err) { err.style.display = 'block'; err.textContent = msg; }
}

// Arranque de sesión: si hay sesión activa carga el perfil y entra; si no,
// muestra el login. Además escucha cambios de auth en tiempo real.
async function initAuth(){
  // Mensaje pendiente de un intento no autorizado previo (tras el reload de signOut).
  try {
    const pend = sessionStorage.getItem(SS_AUTH_ERR);
    if (pend) { mostrarErrorLogin(pend); sessionStorage.removeItem(SS_AUTH_ERR); }
  } catch {}

  if (!supabaseEnabled) {
    mostrarErrorLogin('Configuración de Supabase incompleta. Revisa los meta tags supabase-url / supabase-anon-key.');
    mostrarLogin();
    return;
  }

  const { data: { session } } = await getCurrentSession();
  if (session && session.user) {
    await onLoginExitoso(session.user);
  } else {
    mostrarLogin();
  }

  // Reaccionar en tiempo real al login (tras el redirect de Google) y al logout.
  onAuthStateChange((event, sess) => {
    if (event === 'SIGNED_IN' && sess && sess.user) onLoginExitoso(sess.user);
    else if (event === 'SIGNED_OUT') mostrarLogin();
  });
}

// Login exitoso a nivel de Google: valida el perfil contra public.usuarios.
async function onLoginExitoso(authUser){
  // Idempotente: si ya entramos con este mismo usuario, no re-entrar
  // (getCurrentSession y el listener SIGNED_IN pueden dispararse ambos).
  if (S.user && S.user.id === authUser.id) return;

  const perfil = await loadUserProfile(authUser.id);
  if (!perfil || !perfil.activo) {
    const msg = 'Tu cuenta no está autorizada. Contacta al coordinador.';
    try { sessionStorage.setItem(SS_AUTH_ERR, msg); } catch {}
    mostrarErrorLogin(msg);
    await signOut();   // cierra la sesión de Google que quedó (recarga la página)
    return;
  }

  let alias = perfil.alias;
  if (!alias) {
    console.warn('[Auth] alias null en public.usuarios para', perfil.email, '— usando primer nombre como fallback');
    alias = (perfil.nombre || '').trim().split(/\s+/)[0] || perfil.email;
  }
  S.user = {
    id: perfil.id, email: perfil.email, nombre: perfil.nombre,
    alias, rol: perfil.rol, sede_asignada: perfil.sede_asignada
  };
  await cargarAsesoresCC();
  cargarContenido();   // en fondo: el contenido editable pisa el seed de DATA
  enterApp();
}

// =============================================================
//  CONTENIDO OPERATIVO EDITABLE (Fase 2 · Entrega 1)
//  spec 2026-08-01-contenido-operativo-editable
// =============================================================
const LS_CONTENIDO = 'ceta_contenido_v1';

// Aplica las filas de Supabase sobre DATA (campanias, escalamiento,
// extensiones, vip, picoPlaca, conocimiento). DATA queda de respaldo si
// nunca ha cargado nada.
function aplicarContenido(filas){
  if (!Array.isArray(filas) || !filas.length) return;
  S.contenido = filas;
  Object.assign(DATA, contenidoADATA(filas));
}

async function cargarContenido(){
  // 1) caché local primero (lectura instantánea, incluso sin conexión)
  try { aplicarContenido(JSON.parse(localStorage.getItem(LS_CONTENIDO) || 'null')); } catch {}
  // 2) Supabase = fuente de verdad
  if (!supabaseEnabled) return;
  try {
    const filas = await sbListarContenido();
    aplicarContenido(filas);
    try { localStorage.setItem(LS_CONTENIDO, JSON.stringify(filas)); } catch {}
    // re-pintar las vistas de consulta con el contenido fresco (renderContent
    // es quien pinta Campañas/VIP/Contactos/Productos; goTo no las re-renderiza)
    if (S.user) renderContent();
    if ($('#v-contenido')?.classList.contains('active')) renderContenidoEditor();
  } catch (e) { console.warn('[CETA] cargarContenido', e); }
}

// Definición de campos por tipo (formulario del editor).
const CONT_TIPOS = {
  campania:     { label: 'Campañas',            tituloDe: 'titulo', campos: [
    { k:'titulo', l:'Título' }, { k:'vigente', l:'Vigente', t:'bool' }, { k:'permanente', l:'Permanente (sin fechas)', t:'bool' },
    { k:'desde', l:'Vigente desde', t:'date' }, { k:'hasta', l:'Vigente hasta', t:'date' },
    { k:'resumen', l:'Resumen', t:'area' }, { k:'link', l:'Link' }, { k:'guion', l:'Guion asociado' } ] },
  escalamiento: { label: 'Escalamiento',        tituloDe: 'cargo', campos: [
    { k:'grupo', l:'Grupo', t:'sel', op:['Gerentes y Directores','Jefes de Taller y Líderes Posventa','Servicios de apoyo'] },
    { k:'cargo', l:'Cargo' }, { k:'nombre', l:'Nombre' }, { k:'tel', l:'Teléfono' }, { k:'email', l:'Email' } ] },
  extension:    { label: 'Extensiones',         tituloDe: 'nombre', campos: [
    { k:'nombre', l:'Nombre' }, { k:'ext', l:'Extensión' }, { k:'rol', l:'Rol' } ] },
  vip:          { label: 'Clientes VIP',        tituloDe: 'nombre', campos: [
    { k:'nombre', l:'Nombre' }, { k:'placa', l:'Placa' }, { k:'tel', l:'Teléfono' }, { k:'nota', l:'Nota' } ] },
  pico_placa:   { label: 'Pico y placa',        tituloDe: 'ciudad', campos: [
    { k:'ciudad', l:'Ciudad' }, { k:'horario', l:'Horario' }, { k:'dias', l:'Días y dígitos', t:'json' }, { k:'noAplica', l:'No aplica' } ] },
  directorio:   { label: 'Directorio Armotor',   tituloDe: 'nombre', campos: [
    { k:'nombre', l:'Nombre' },
    { k:'ciudad', l:'Sede', t:'sel', op:['Regional','Manizales','Pereira','Armenia','Cartago','La Dorada'] },
    { k:'area', l:'Cargo / Área' }, { k:'cel', l:'Celular' }, { k:'ext', l:'Extensión' } ] },
  conocimiento: { label: 'Base de Conocimiento', tituloDe: 'titulo', campos: [
    { k:'titulo', l:'Título' }, { k:'cat', l:'Categoría', t:'sel', op:['critico','productos','operativo'] },
    { k:'resumen', l:'Resumen', t:'area' }, { k:'contenido', l:'Contenido completo', t:'area' },
    { k:'tags', l:'Tags (separadas por coma)', t:'tags' } ] }
};
let contTipoActivo = 'campania';

function renderContenidoEditor(){
  const el = $('#v-contenido'); if (!el) return;
  if (!can('editarContenido')) { el.innerHTML = emptyState('fa-lock', 'Editar contenido', 'Tu rol no tiene acceso a esta sección.'); return; }
  const filas = (S.contenido || []).filter(f => f.tipo === contTipoActivo)
    .sort((a, b) => (a.orden ?? 9e9) - (b.orden ?? 9e9));
  el.innerHTML = `
    ${viewHead('Editar contenido', `<span class="badge"><i class="fas fa-pen-to-square"></i> Coordinación</span>`)}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${Object.entries(CONT_TIPOS).map(([k, t]) => `<button class="pill cont-tab ${k===contTipoActivo?'on':''}" data-tipo="${k}">${esc(t.label)}</button>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-ac" id="contNueva"><i class="fas fa-plus"></i> Nueva entrada</button>
    </div>
    <div class="fb">
      ${filas.length ? `<table class="tbl"><thead><tr><th>Título</th><th>Estado</th><th>Últ. cambio</th><th style="width:150px"></th></tr></thead><tbody>
        ${filas.map(f => `<tr>
          <td><strong>${esc(f.titulo)}</strong></td>
          <td>${f.activo ? '<span class="tag" style="background:rgba(34,197,94,.12);color:var(--ok)">Activa</span>' : '<span class="tag" style="background:var(--bgs);color:var(--tx3)">Inactiva</span>'}</td>
          <td style="font-size:11px;color:var(--tx3)">${esc(f.actualizadoAlias || '—')}${f.actualizado_en ? ' · ' + esc(fmtFechaHora(new Date(f.actualizado_en).getTime())) : ''}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-gh cont-editar" data-id="${esc(f.id)}" title="Editar" style="padding:3px 8px"><i class="fas fa-pen"></i></button>
            <button class="btn btn-gh cont-toggle" data-id="${esc(f.id)}" title="${f.activo ? 'Desactivar' : 'Reactivar'}" style="padding:3px 8px"><i class="fas fa-power-off" style="${f.activo ? '' : 'color:var(--tx3)'}"></i></button>
            <button class="btn btn-gh cont-hist" data-id="${esc(f.id)}" title="Historial" style="padding:3px 8px"><i class="fas fa-clock-rotate-left"></i></button>
            ${S.user?.rol === 'administrador' ? `<button class="btn btn-gh cont-borrar" data-id="${esc(f.id)}" title="Eliminar definitivo" style="padding:3px 8px;color:var(--wr)"><i class="fas fa-trash"></i></button>` : ''}
          </td></tr>`).join('')}
      </tbody></table>` : emptyState('fa-inbox', 'Sin entradas', 'Crea la primera con "Nueva entrada".')}
    </div>
    <div style="font-size:10px;color:var(--tx3);margin-top:8px"><i class="fas fa-circle-info"></i> Desactivar oculta la entrada a los asesores sin borrarla. El borrado definitivo es solo del administrador. Los asesores ven los cambios al recargar o cambiar de vista.</div>`;
  $$('#v-contenido .cont-tab').forEach(b => b.addEventListener('click', () => { contTipoActivo = b.dataset.tipo; renderContenidoEditor(); }));
  $('#contNueva')?.addEventListener('click', () => openContenidoForm(null));
  $$('#v-contenido .cont-editar').forEach(b => b.addEventListener('click', () => openContenidoForm(b.dataset.id)));
  $$('#v-contenido .cont-toggle').forEach(b => b.addEventListener('click', async () => {
    const f = (S.contenido || []).find(x => x.id === b.dataset.id); if (!f) return;
    try {
      await sbActivarContenido(f, !f.activo, S.user);
      toast(f.activo ? '⏸️ Entrada desactivada' : '✅ Entrada reactivada');
      cargarContenido().then(renderContenidoEditor);
    } catch (e) { console.error(e); toast('⚠️ No se pudo cambiar el estado — reintenta'); }
  }));
  $$('#v-contenido .cont-hist').forEach(b => b.addEventListener('click', () => openContenidoHistorial(b.dataset.id)));
  $$('#v-contenido .cont-borrar').forEach(b => b.addEventListener('click', () => {
    const f = (S.contenido || []).find(x => x.id === b.dataset.id); if (!f) return;
    modalOpen(`
      <div class="modal-head"><h3><i class="fas fa-trash" style="color:var(--wr)"></i> Eliminar definitivo</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
      <div class="modal-body"><div class="al wr" style="font-size:12px"><i class="fas fa-triangle-exclamation"></i><div>Se eliminará <strong>${esc(f.titulo)}</strong> y su historial. Esta acción no se puede deshacer. Si solo quieres ocultarla, usa Desactivar.</div></div></div>
      <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="contBorrarSi" style="background:var(--wr)"><i class="fas fa-trash"></i> Eliminar</button></div>`);
    $('#contBorrarSi').addEventListener('click', async () => {
      try { await sbEliminarContenido(f.id); modalClose(); toast('🗑️ Entrada eliminada'); cargarContenido().then(renderContenidoEditor); }
      catch (e) { console.error(e); toast('⚠️ No se pudo eliminar'); }
    });
  }));
}

function valorCampoContenido(c, v){
  if (c.t === 'tags') return Array.isArray(v) ? v.join(', ') : (v || '');
  if (c.t === 'json') return v ? JSON.stringify(v) : '';
  return v ?? '';
}

function openContenidoForm(id){
  const def = CONT_TIPOS[contTipoActivo];
  const f = id ? (S.contenido || []).find(x => x.id === id) : null;
  const d = f?.datos || {};
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-pen"></i> ${f ? 'Editar' : 'Nueva'} · ${esc(def.label)}</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      ${def.campos.map(c => `<div class="ff" style="margin-bottom:10px"><label>${esc(c.l)}</label>${
        c.t === 'area' ? `<textarea data-ck="${c.k}" rows="5">${esc(valorCampoContenido(c, d[c.k]))}</textarea>` :
        c.t === 'bool' ? `<select data-ck="${c.k}"><option value="true" ${d[c.k] ? 'selected' : ''}>Sí</option><option value="false" ${d[c.k] ? '' : 'selected'}>No</option></select>` :
        c.t === 'sel'  ? `<select data-ck="${c.k}">${c.op.map(o => `<option ${d[c.k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` :
        `<input data-ck="${c.k}" type="${c.t === 'date' ? 'date' : 'text'}" value="${esc(valorCampoContenido(c, d[c.k]))}">`
      }</div>`).join('')}
    </div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="contGuardar"><i class="fas fa-floppy-disk"></i> Guardar</button></div>`);
  $('#contGuardar').addEventListener('click', async () => {
    const nuevos = { ...d };
    def.campos.forEach(c => {
      const el2 = $(`[data-ck="${c.k}"]`); if (!el2) return;
      let v = el2.value;
      if (c.t === 'bool') v = v === 'true';
      else if (c.t === 'tags') v = v.split(',').map(s => s.trim()).filter(Boolean);
      else if (c.t === 'json') { try { v = v ? JSON.parse(v) : null; } catch { toast('⚠️ El campo "' + c.l + '" no es un JSON válido'); throw new Error('json inválido'); } }
      else v = v.trim();
      if (v === '' || v == null) delete nuevos[c.k]; else nuevos[c.k] = v;
    });
    const titulo = String(nuevos[def.tituloDe] || '').trim();
    if (!titulo) { toast('El campo "' + def.campos.find(c => c.k === def.tituloDe).l + '" es obligatorio'); return; }
    // aviso de duplicado por título+tipo (spec: se confirma para continuar)
    const dup = (S.contenido || []).find(x => x.tipo === contTipoActivo && x.titulo.toLowerCase() === titulo.toLowerCase() && x.id !== id);
    if (dup && !confirm('Ya existe una entrada "' + dup.titulo + '" en ' + def.label + '. ¿Guardar de todas formas?')) return;
    if (contTipoActivo === 'conocimiento') {
      nuevos.badge = { critico: 'red', productos: 'gold', operativo: 'green' }[nuevos.cat] || 'green';
      if (!nuevos.id) nuevos.id = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    }
    if (contTipoActivo === 'campania' && !nuevos.id) nuevos.id = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    try {
      if (f) await sbEditarContenido(f, nuevos, titulo, S.user);
      else await sbCrearContenido(contTipoActivo, titulo, nuevos, S.user);
      modalClose(); toast('✅ Guardado');
      cargarContenido().then(renderContenidoEditor);
    } catch (e) { console.error(e); toast('⚠️ No se pudo guardar — reintenta (lo escrito se conserva)'); }
  });
}

function openContenidoHistorial(id){
  const f = (S.contenido || []).find(x => x.id === id); if (!f) return;
  const h = [...(f.historial || [])].reverse();
  const fmtV = v => v == null ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-clock-rotate-left"></i> Historial · ${esc(f.titulo)}</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      ${h.length ? h.map(x => `<div style="border-left:2px solid var(--bd);padding:4px 10px;margin-bottom:8px;font-size:12px">
        <div style="color:var(--tx3);font-size:10px">${esc(fmtFechaHora(new Date(x.ts).getTime()))} · ${esc(x.autor || '—')}</div>
        <div><strong>${esc(x.campo)}</strong>: ${esc(fmtV(x.de))} → ${esc(fmtV(x.a))}</div>
      </div>`).join('') : '<div style="color:var(--tx3);font-size:12px">Sin cambios registrados.</div>'}
    </div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cerrar</button></div>`);
}

// Cierra sesión: Supabase limpia el estado y recarga; initAuth mostrará el login.
function logout(){
  signOut();
}

function enterApp(){
  $('#loginScreen').style.display = 'none';
  $('#appRoot').style.display = 'grid';
  applyRole();
  poblarListasPanel();
  poblarHoras();             // selects de hora por franjas (punto 14)
  poblarComunicaSub();       // sub-motivos de "Cliente se comunica" (punto 5)
  poblarWgQuien();           // quién recoge según ciudad (puntos 8/9)
  cargarCotizadorEnVivo();   // 3 capas: cache → API → seed; rellena precios y puebla
  renderHome();
  renderContent();
  renderConfig();
  if (can('config')) renderAlertas();
  refrescarAlertasUI();
  pickRes($('#resP .pill[data-r="agenda"]'));
  goTo('home');

  // Traer las gestiones y la cola de seguimientos desde Supabase al entrar
  // (la caché local pinta primero; esto revalida en fondo).
  refrescarGestiones({ silencioso:true });
  refrescarSeguimientos();

  // Refresco de temporizadores de la bandeja (SLA 5 min) cada 30 s.
  if (!window._slaTimer) window._slaTimer = setInterval(() => {
    if ($('#v-internos')?.classList.contains('active')) renderBandeja();
    updateInternosBadges();
  }, 30000);
}

// =============================================================
//  ROLES Y PERMISOS
// =============================================================
function rolLabel(r){
  return { administrador:'Administrador', coordinador:'Coordinador', analista:'Analista', asesor_cc:'Asesor Taller', asesor_digital:'Asesor Digital' }[r] || r;
}
function perms(){ return DATA.permisos[S.user?.rol] || {}; }
function can(p){ return !!perms()[p]; }
// administrador y coordinador comparten el mando operativo (ver/editar todo).
function esCoordinacion(){ return !!S.user && (S.user.rol === 'coordinador' || S.user.rol === 'administrador'); }

function applyRole(){
  const u = S.user, p = perms();
  // Chip de usuario
  $('#userAv').textContent = (u.alias || u.nombre).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  $('#userName').textContent = u.alias || u.nombre;
  $('#userRole').textContent = rolLabel(u.rol);
  $('#ftUser').textContent = u.alias || u.nombre;

  // Ocultar items por permiso (data-perm = clave booleana de permisos)
  $$('[data-perm]').forEach(el => {
    const key = el.dataset.perm;
    const val = p[key];
    el.style.display = (val === true || val === 'propios') ? '' : 'none';
  });

  // Panel de cierre: solo lectura para quien no puede registrar
  const puedeRegistrar = can('registrar');
  $('#rpBody').style.display = puedeRegistrar ? '' : 'none';
  $('#rpLocked').style.display = puedeRegistrar ? 'none' : 'block';

  // Precargar asesor CETA implícito = usuario logueado (no se escribe)
  S.f.asesorCeta = u.alias;
}

// =============================================================
//  HOME (stats según rol)
// =============================================================
function renderHome(){
  const u = S.user, p = perms();
  $('#homeHello').textContent = `Hola ${ (u.alias||u.nombre).split(' ')[0] } 👋 ¿Qué necesitas resolver?`;
  $('#homeSub').textContent = p.homeEquipo
    ? 'Vista de coordinación — métricas del equipo CETA.'
    : 'Tu consola para atención telefónica, digital y operativa.';

  // Stats REALES calculadas desde las gestiones guardadas.
  const equipo = p.homeEquipo;
  const hoyStr2 = new Date().toISOString().slice(0,10);
  const todas = getGestionesLocal();
  const propias = equipo ? todas : todas.filter(g => (g.asesorCeta||g.asignadoAlias) === S.user.alias);
  const deHoy = propias.filter(g => new Date(g._ts||0).toISOString().slice(0,10) === hoyStr2);
  const agend = propias.filter(g => g.resultado === 'agenda').length;
  const pend = propias.filter(g => g.resultado === 'pendiente').length;
  const stats = equipo
    ? [[String(todas.length),'Gestiones totales',''],[String(todas.filter(g=>g.resultado==='agenda').length),'Agendadas','var(--ok)'],[String(todas.filter(g=>g.resultado==='pendiente').length),'Pendientes','var(--wr)'],[String(deHoy.length),'Hoy','']]
    : [[String(deHoy.length),'Mis gestiones hoy',''],[String(agend),'Mis agendadas','var(--ok)'],[String(pend),'Mis pendientes','var(--wr)'],[String(propias.length),'Mi total','']];
  $('#homeStats').innerHTML = stats.map(([n,l,c]) =>
    `<div><div style="font-family:var(--fd);font-weight:700;font-size:20px;${c?`color:${c}`:''}">${n}</div><div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${l}</div></div>`
  ).join('');

  // Accesos rápidos
  const quick = [
    ['inbound','fa-phone-volume','var(--ac)','var(--acs)','Agendar cita','Flujo Inbound 10 pasos'],
    ['inbound','fa-calculator','var(--ok)','var(--oks)','Cotizador','Integrado en panel derecho'],
    ['leads','fa-bullseye','var(--in)','var(--ins)','Calificar lead','P1 · P2 · P3 · P4'],
    ['whatsapp','fab fa-whatsapp','var(--wr)','var(--wrs)','Plantillas WhatsApp','Mensajería digital'],
    ['campanias','fa-bullhorn','var(--ac)','var(--acs)','Campañas','Seguridad · Total Confianza'],
    ['contactos','fa-address-book','var(--in)','var(--ins)','Contactos y Sedes','Corporativos · IVR'],
    ['vip','fa-crown','var(--gd)','rgba(180,83,9,.1)','Clientes VIP','Prioritarios']
  ];
  $('#homeQuick').innerHTML = quick.map(([v,ic,col,bg,t,s]) => {
    const fa = ic.startsWith('fab') ? ic : `fas ${ic}`;
    return `<button data-go="${v}" style="background:var(--bgp);border:1px solid var(--bd);border-radius:8px;padding:14px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px;font-family:var(--f);color:var(--tx)">
      <div style="width:32px;height:32px;border-radius:6px;background:${bg};display:grid;place-items:center;color:${col};font-size:14px"><i class="${fa}"></i></div>
      <div style="font-size:13px;font-weight:600">${t}</div><div style="font-size:11px;color:var(--tx3)">${s}</div></button>`;
  }).join('');
  $$('#homeQuick [data-go]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));
}

// =============================================================
//  HELPERS de render
// =============================================================
function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function nl2br(s){ return esc(s).replace(/\n/g,'<br>'); }
function viewHead(title, badges){
  return `<h1 class="ft-title">${title}</h1>${badges?`<div class="badges">${badges}</div>`:''}`;
}

// =============================================================
//  INBOUND — 10 pasos navegables (← →)
// =============================================================
let inboundIdx = 0;
function renderInbound(){
  const wrap = $('#inboundWrap');
  const pasos = DATA.inbound || [];
  if (!pasos.length) { wrap.innerHTML = emptyState('fa-phone-volume','Inbound Posventa','Sin contenido cargado.'); return; }
  const i = Math.max(0, Math.min(inboundIdx, pasos.length-1));
  inboundIdx = i;
  const ps = pasos[i];
  const decir = (ps.decir||[]).map(d =>
    `${d.sub?`<div class="sub-l" style="margin-top:8px"><i class="fas fa-angle-right"></i>${esc(d.sub)}</div>`:''}<div class="sp">${nl2br(d.texto)}</div>`
  ).join('');
  wrap.innerHTML = `
    ${viewHead(`Flujo Inbound · Paso ${ps.paso} — ${esc(ps.titulo)}`,
      `<span class="badge voz"><i class="fas fa-phone"></i> Voz</span><span class="badge vig"><i class="fas fa-clock" style="font-size:8px"></i> ${esc(ps.tiempo||'')}</span>${ps.critico?'<span class="badge" style="background:var(--acs);color:var(--ac)"><i class="fas fa-star"></i> Crítico</span>':''}`)}
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">
      ${pasos.map((p,idx)=>`<button class="pill ${idx===i?'on':''}" data-step="${idx}" style="min-width:26px;justify-content:center">${p.paso}</button>`).join('')}
    </div>
    <div class="fb"><div class="bt val"><span class="n">1</span>Qué validar</div><div style="font-size:12px;line-height:1.6">${nl2br(ps.validar)}</div></div>
    <div class="fb"><div class="bt say"><span class="n">2</span>Qué decir al cliente</div>${decir}</div>
    <div class="fb"><div class="bt do"><span class="n">3</span>Qué hacer después</div><div style="font-size:12px;line-height:1.6">${nl2br(ps.hacer)}</div></div>
    ${ps.escalar?`<div class="fb"><div class="bt esc"><span class="n">4</span>Cuándo escalar</div><div class="al wr"><i class="fas fa-triangle-exclamation"></i><div>${nl2br(ps.escalar)}</div></div></div>`:''}
    ${ps.nota?`<div class="al in"><i class="fas fa-lightbulb"></i><div>${nl2br(ps.nota)}</div></div>`:''}
    <div style="display:flex;gap:6px;margin-top:14px">
      <button class="btn btn-gh" id="ibPrev" ${i===0?'disabled':''}><i class="fas fa-chevron-left"></i> Paso ${i>0?pasos[i-1].paso:''}</button>
      <button class="btn btn-ac" id="ibNext" ${i===pasos.length-1?'disabled':''}>Paso ${i<pasos.length-1?pasos[i+1].paso:''} <i class="fas fa-chevron-right"></i></button>
    </div>`;
  $$('#inboundWrap [data-step]').forEach(b => b.addEventListener('click', () => { inboundIdx = +b.dataset.step; renderInbound(); }));
  const prev = $('#ibPrev'), next = $('#ibNext');
  if (prev) prev.addEventListener('click', () => { inboundIdx--; renderInbound(); });
  if (next) next.addEventListener('click', () => { inboundIdx++; renderInbound(); });
}

// =============================================================
//  OUTBOUND — fichas con momentos
// =============================================================
let outboundId = null;
function renderOutbound(){
  const el = $('#v-outbound');
  const list = DATA.outbound || [];
  if (!list.length) { el.innerHTML = emptyState('fa-arrow-up-from-bracket','Outbound','Sin contenido cargado.'); return; }
  if (!outboundId) outboundId = list[0].id;
  const g = list.find(x => x.id === outboundId) || list[0];
  el.innerHTML = `
    ${viewHead('Guiones Outbound', list.map(x =>
      `<button class="pill ${x.id===outboundId?'on':''}" data-ob="${x.id}">${esc(x.titulo.split('—')[0].trim())}</button>`).join(''))}
    <div class="fb" style="border-left:3px solid var(--ac)">
      <div style="font-family:var(--fd);font-weight:700;font-size:15px;margin-bottom:4px">${esc(g.titulo)}</div>
      <div class="badges"><span class="badge kia">${esc(g.marca)}</span><span class="badge"><i class="fas fa-tag"></i> ${esc(g.badge)}</span></div>
      <div style="font-size:12px;color:var(--tx2);line-height:1.6">${nl2br(g.contexto)}</div>
    </div>
    <div class="fb"><div class="bt val"><span class="n"><i class="fas fa-list-check"></i></span>Validar antes de llamar</div><div style="font-size:12px;line-height:1.6">${nl2br(g.validar)}</div></div>
    ${(g.momentos||[]).map(m =>
      `<div class="fb"><div class="bt say"><span class="n"><i class="fas fa-quote-left" style="font-size:8px"></i></span>${esc(m.titulo)}</div><div class="sp">${nl2br(m.texto)}</div></div>`).join('')}
    <div class="fb"><div class="bt do"><span class="n"><i class="fas fa-forward"></i></span>Qué hacer</div><div style="font-size:12px;line-height:1.6">${nl2br(g.hacer)}</div></div>
    ${g.escalar?`<div class="fb"><div class="bt esc"><span class="n"><i class="fas fa-triangle-exclamation" style="font-size:9px"></i></span>Escalar / Pendiente</div><div class="al wr"><i class="fas fa-triangle-exclamation"></i><div>${nl2br(g.escalar)}</div></div></div>`:''}`;
  $$('#v-outbound [data-ob]').forEach(b => b.addEventListener('click', () => { outboundId = b.dataset.ob; renderOutbound(); }));
}

// =============================================================
//  PLANTILLAS WHATSAPP — categorías + búsqueda + copiar
// =============================================================
let waCat = 'all', waQuery = '';
function renderWhatsapp(){
  const el = $('#v-whatsapp');
  const cats = DATA.plantillasCategorias || [];
  const plantillas = DATA.plantillas || [];
  const q = waQuery.trim().toLowerCase();
  const filtered = plantillas.filter(p =>
    (waCat==='all' || p.cat===waCat) &&
    (!q || (p.titulo+p.texto+p.usar).toLowerCase().includes(q)));
  el.innerHTML = `
    ${viewHead('Plantillas WhatsApp', `<span class="badge"><i class="fab fa-whatsapp"></i> ${plantillas.length} plantillas</span><span class="badge"><i class="fas fa-layer-group"></i> ${cats.length} categorías</span>`)}
    <div class="omni" style="max-width:none;margin-bottom:12px"><i class="fas fa-search" style="color:var(--tx3);font-size:12px"></i><input id="waSearch" placeholder="Buscar plantilla por texto…" value="${esc(waQuery)}"></div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">
      <button class="pill ${waCat==='all'?'on':''}" data-wacat="all">Todas</button>
      ${cats.map(c => `<button class="pill ${waCat===c?'on':''}" data-wacat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    ${filtered.length ? filtered.map(p => `
      <div class="fb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
          <div><span style="font-family:var(--fm);font-size:10px;color:var(--ac);font-weight:700">${esc(p.id)}</span> <strong style="font-size:13px">${esc(p.titulo)}</strong><div style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(p.usar)}</div></div>
          <button class="btn btn-ok wa-copy" data-id="${esc(p.id)}" style="flex-shrink:0"><i class="fas fa-copy"></i> Copiar</button>
        </div>
        <div class="out-box" style="max-height:none">${nl2br(p.texto)}</div>
        ${(p.vars&&p.vars.length)?`<div style="margin-top:6px;font-size:10px;color:var(--tx3)">Variables: ${p.vars.map(v=>`<span style="font-family:var(--fm);background:var(--bgs);padding:1px 5px;border-radius:3px;margin-right:3px">[${esc(v)}]</span>`).join('')}</div>`:''}
      </div>`).join('') : emptyState('fa-magnifying-glass','Sin resultados','No hay plantillas que coincidan con tu búsqueda.')}`;
  const s = $('#waSearch');
  if (s) s.addEventListener('input', e => { waQuery = e.target.value; const pos=e.target.selectionStart; renderWhatsapp(); const ns=$('#waSearch'); if(ns){ns.focus(); ns.setSelectionRange(pos,pos);} });
  $$('#v-whatsapp [data-wacat]').forEach(b => b.addEventListener('click', () => { waCat = b.dataset.wacat; renderWhatsapp(); }));
  $$('#v-whatsapp .wa-copy').forEach(b => b.addEventListener('click', () => {
    const p = plantillas.find(x => x.id === b.dataset.id);
    if (p) { navigator.clipboard.writeText(p.texto); flash(b); }
  }));
}

// =============================================================
//  CALIFICADOR DE LEADS — pills que calculan P1-P4 en vivo
// =============================================================
const calSel = {};  // grupo -> Set de pill ids
function calPuntaje(){
  let total = 0;
  const c = DATA.calificador;
  c.fases.forEach(f => {
    const sel = calSel[f.grupo];
    if (!sel) return;
    // pills no acumulables: solo cuenta la mayor; acumulables: suman
    let baseMax = 0, extra = 0;
    f.pills.forEach(p => { if (sel.has(p.id)) { if (p.acumulable) extra += p.pts; else baseMax = Math.max(baseMax, p.pts); } });
    total += baseMax + extra;
  });
  return total;
}
function calClasificacion(pts){
  return (DATA.calificador.clasificaciones || []).find(c => pts >= c.rango[0] && pts <= c.rango[1]) || null;
}
function renderLeads(){
  const el = $('#v-leads');
  const c = DATA.calificador;
  if (!c || !c.fases) { el.innerHTML = emptyState('fa-bullseye','Lead Comercial','Sin contenido cargado.'); return; }
  el.innerHTML = `
    ${viewHead('Calificador Comercial', `<span class="badge voz"><i class="fas fa-phone"></i> Voz · Leads</span><span class="badge"><i class="fas fa-bolt"></i> 5–8 clicks</span>`)}
    <div class="fb" id="calResultBox" style="border-left:3px solid var(--ac);position:sticky;top:0;z-index:5"></div>
    ${c.fases.map(f => `
      <div class="fb">
        <div class="bt say"><span class="n">${f.n}</span>${esc(f.titulo)} <span style="margin-left:auto;font-weight:500;text-transform:none;letter-spacing:0;color:var(--tx3)">${esc(f.tiempo)} · ${esc(f.califica)}</span></div>
        <div style="font-size:12px;line-height:1.6;margin-bottom:10px">${(f.decir||[]).map(d=>`<div style="margin-bottom:5px;padding-left:10px;border-left:2px solid var(--bd)">${nl2br(d)}</div>`).join('')}</div>
        <div class="pills">${f.pills.map(p=>`<button class="pill ${p.color}" data-grp="${f.grupo}" data-pid="${p.id}" data-acc="${p.acumulable?1:0}">${esc(p.label)} · +${p.pts}</button>`).join('')}</div>
      </div>`).join('')}
    <div class="fb"><div class="bt do"><span class="n">5</span>Cierre y decisión</div>
      <div class="sub-l"><i class="fas fa-check"></i>Si ≥ 10 (P1/P2/P3) — Asignar</div><div class="sp" style="border-left-color:var(--ok)">${nl2br(c.cierre.asignar)}</div>
      <div class="sub-l" style="margin-top:10px"><i class="fas fa-xmark"></i>Si < 10 (P4) — No asignar</div><div class="sp" style="border-left-color:var(--wr)">${nl2br(c.cierre.noAsignar)}</div>
    </div>
    <div class="fb"><div class="bt esc"><span class="n"><i class="fas fa-shield"></i></span>Manejo de objeciones</div>
      ${c.objeciones.map(o=>`<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--ac)">${esc(o.q)}</div><div style="font-size:12px;color:var(--tx2);line-height:1.5">${esc(o.a)}</div></div>`).join('')}
    </div>
    <div class="fb"><div class="bt val"><span class="n"><i class="fas fa-arrows-turn-right"></i></span>Sistemas de transferencia</div>
      <table class="tbl"><thead><tr><th>Marca</th><th>Sistema</th><th>Acción</th></tr></thead><tbody>
      ${c.sistemas.map(s=>`<tr><td><strong>${esc(s.marca)}</strong></td><td>${esc(s.sistema)}</td><td>${esc(s.accion)}</td></tr>`).join('')}
      </tbody></table>
    </div>`;
  $$('#v-leads .pill[data-grp]').forEach(b => b.addEventListener('click', () => {
    const grp = b.dataset.grp, pid = b.dataset.pid, acc = b.dataset.acc==='1';
    if (!calSel[grp]) calSel[grp] = new Set();
    const sel = calSel[grp];
    if (sel.has(pid)) { sel.delete(pid); b.classList.remove('sel-on'); b.style.outline=''; }
    else {
      if (!acc) { // exclusivo: limpiar otras no-acumulables del grupo
        const fase = c.fases.find(f=>f.grupo===grp);
        fase.pills.forEach(p => { if (!p.acumulable && sel.has(p.id)) { sel.delete(p.id); const ob=$(`#v-leads .pill[data-pid="${p.id}"]`); if(ob){ob.style.outline='';} } });
      }
      sel.add(pid); b.style.outline='2px solid currentColor';
    }
    renderCalResult();
  }));
  renderCalResult();
}
function renderCalResult(){
  const box = $('#calResultBox'); if (!box) return;
  const pts = calPuntaje(), cl = calClasificacion(pts);
  box.innerHTML = `<div style="display:flex;align-items:center;gap:14px">
    <div style="font-family:var(--fd);font-size:30px;font-weight:800">${pts}<span style="font-size:13px;color:var(--tx3)">/100</span></div>
    <div>${cl?`<div style="font-family:var(--fd);font-weight:700;font-size:16px;color:${cl.color}">${cl.id} · ${esc(cl.nombre)}</div><div style="font-size:11px;color:var(--tx2)">${esc(cl.accion)} — ${esc(cl.sistema)}</div>`:'<div style="color:var(--tx3)">Sin puntaje</div>'}</div>
    <button class="btn btn-gh" id="calReset" style="margin-left:auto"><i class="fas fa-rotate-left"></i> Reiniciar</button>
  </div>`;
  const r = $('#calReset'); if (r) r.addEventListener('click', () => { Object.keys(calSel).forEach(k=>delete calSel[k]); renderLeads(); });
}

// =============================================================
//  CONTACTOS Y SEDES (+ escalamiento + extensiones + pico y placa)
// =============================================================
let contQuery = '';
function renderContactos(){
  const el = $('#v-contactos');
  const q = contQuery.trim().toLowerCase();
  const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);
  const sedes = (DATA.sedes||[]).filter(s => match(s.nombre, s.direccion, ...(s.contactos||[]).map(c=>c.nombre+c.area)));
  const esc2 = el => el;
  el.innerHTML = `
    ${viewHead('Contactos y Sedes', `<span class="badge"><i class="fas fa-location-dot"></i> ${(DATA.sedes||[]).length} sedes</span><span class="badge"><i class="fas fa-headset"></i> Escalamiento + IVR</span>`)}
    <div class="omni" style="max-width:none;margin-bottom:14px"><i class="fas fa-search" style="color:var(--tx3);font-size:12px"></i><input id="contSearch" placeholder="Buscar sede, contacto o área…" value="${esc(contQuery)}"></div>

    <div class="sub-l"><i class="fas fa-store"></i>Sedes</div>
    ${sedes.map(s => `<div class="fb">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="font-family:var(--fd);font-weight:700;font-size:14px">${esc(s.nombre)}</div>
        <div class="badges" style="margin:0">${(s.marcas||[]).map(m=>`<span class="badge">${esc(m)}</span>`).join('')}</div>
      </div>
      <div style="font-size:12px;color:var(--tx2);margin:6px 0">${esc(s.direccion)}${s.maps?` · <a href="${esc(s.maps)}" target="_blank" style="color:var(--in)">Mapa</a>`:''}</div>
      <div style="font-size:11px;color:var(--tx3)"><i class="fas fa-wrench"></i> Taller: ${esc(s.horarioTaller||'—')}${s.horarioVitrina?`<br><i class="fas fa-store"></i> Vitrina: ${esc(s.horarioVitrina)}`:''}</div>
      ${s.nota?`<div class="al in" style="margin-top:6px;font-size:11px"><i class="fas fa-circle-info"></i><div>${esc(s.nota)}</div></div>`:''}
      ${(s.contactos&&s.contactos.length)?`<table class="tbl" style="margin-top:8px"><tbody>${s.contactos.map(c=>`<tr><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.area)}</td><td style="font-family:var(--fm);font-size:11px">${c.ext?'Ext '+esc(c.ext):''}${c.cel?(c.ext?' · ':'')+esc(c.cel):''}</td></tr>`).join('')}</tbody></table>`:''}
    </div>`).join('') || emptyState('fa-magnifying-glass','Sin resultados','Ninguna sede coincide.')}

    <div class="sub-l" style="margin-top:16px"><i class="fas fa-headset"></i>Contactos de escalamiento</div>
    ${(DATA.escalamiento||[]).map(g=>`<div class="fb"><div class="bt val" style="margin-bottom:8px"><span class="n"><i class="fas fa-users"></i></span>${esc(g.grupo)}</div>
      <table class="tbl"><tbody>${g.items.filter(it=>match(it.nombre,it.cargo,it.tel)).map(it=>`<tr><td>${esc(it.cargo)}</td><td><strong>${esc(it.nombre)}</strong></td><td style="font-family:var(--fm);font-size:11px">${esc(it.tel)}${it.email?`<br><span style="color:var(--in)">${esc(it.email)}</span>`:''}</td></tr>`).join('')}</tbody></table>
    </div>`).join('')}

    ${(() => {
      // Directorio Armotor por sede (contenido editable, tipo 'directorio')
      const dir = (DATA.directorio || []).filter(d => match(d.nombre, d.area, d.ciudad, d.cel, d.ext));
      if (!dir.length) return '';
      const ordenSede = ['Regional','Manizales','Pereira','Armenia','Cartago','La Dorada'];
      const porSede = {};
      dir.forEach(d => { (porSede[d.ciudad || 'Otros'] = porSede[d.ciudad || 'Otros'] || []).push(d); });
      const sedesOrd = Object.keys(porSede).sort((a, b) => (ordenSede.indexOf(a) + 99 * (ordenSede.indexOf(a) < 0)) - (ordenSede.indexOf(b) + 99 * (ordenSede.indexOf(b) < 0)));
      return `<div class="sub-l" style="margin-top:16px"><i class="fas fa-address-book"></i>Directorio Armotor por sede</div>
        ${sedesOrd.map(sede => `<div class="fb"><div class="bt do" style="margin-bottom:8px"><span class="n"><i class="fas fa-location-dot"></i></span>${esc(sede)} <span style="font-weight:400;color:var(--tx3);font-size:10px">· ${porSede[sede].length} contactos</span></div>
          <table class="tbl"><tbody>${porSede[sede].map(d => `<tr><td><strong>${esc(d.nombre)}</strong></td><td>${esc(d.area || '—')}</td><td style="font-family:var(--fm);font-size:11px">${d.ext ? 'Ext ' + esc(d.ext) : ''}${d.cel ? (d.ext ? ' · ' : '') + esc(d.cel) : ''}</td></tr>`).join('')}</tbody></table>
        </div>`).join('')}`;
    })()}

    <div class="sub-l" style="margin-top:16px"><i class="fas fa-phone-volume"></i>Extensiones equipo CETA</div>
    <div class="fb"><table class="tbl"><thead><tr><th>Nombre</th><th>Ext</th><th>Rol</th></tr></thead><tbody>
      ${(DATA.extensiones||[]).filter(x=>match(x.nombre,x.rol,x.ext)).map(x=>`<tr><td><strong>${esc(x.nombre)}</strong></td><td style="font-family:var(--fm)">${esc(x.ext)}</td><td>${esc(x.rol)}</td></tr>`).join('')}
    </tbody></table></div>

    <div class="sub-l" style="margin-top:16px"><i class="fas fa-ban"></i>Pico y placa</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${Object.entries(DATA.picoPlaca||{}).map(([ciudad,pp])=>`<div class="fb">${pp?`<div style="font-weight:700;margin-bottom:6px">${esc(ciudad)}</div><div style="font-size:11px;color:var(--tx3);margin-bottom:6px">${esc(pp.horario)}</div><table class="tbl"><tbody>${Object.entries(pp.dias).map(([d,n])=>`<tr><td>${esc(d)}</td><td style="font-family:var(--fm)">${esc(n)}</td></tr>`).join('')}</tbody></table><div style="font-size:10px;color:var(--tx3);margin-top:6px">No aplica: ${esc(pp.noAplica)}</div>`:`<div style="font-weight:700;margin-bottom:6px">${esc(ciudad)}</div><div style="font-size:11px;color:var(--tx3)">Pendiente confirmar esquema.</div>`}</div>`).join('')}
    </div>`;
  const cs = $('#contSearch');
  if (cs) cs.addEventListener('input', e => { contQuery = e.target.value; const pos=e.target.selectionStart; renderContactos(); const ns=$('#contSearch'); if(ns){ns.focus(); ns.setSelectionRange(pos,pos);} });
}

// =============================================================
//  PRODUCTOS Y SERVICIOS / MANUALES (fichas de conocimiento)
// =============================================================
function renderConocimiento(viewId, cats, title, icon){
  const el = $('#'+viewId);
  const fichas = (DATA.conocimiento||[]).filter(f => cats.includes(f.cat));
  if (!fichas.length) { el.innerHTML = emptyState(icon,title,'Sin contenido cargado.'); return; }
  const badgeColor = { red:'background:var(--acs);color:var(--ac)', gold:'background:rgba(180,83,9,.1);color:var(--gd)', green:'background:var(--oks);color:var(--ok)' };
  el.innerHTML = `${viewHead(title)}${fichas.map(f=>`
    <div class="fb">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="badge" style="${badgeColor[f.badge]||''}"><i class="fas fa-circle" style="font-size:6px"></i> ${f.cat}</span>
        <strong style="font-size:14px">${esc(f.titulo)}</strong>
      </div>
      <div style="font-size:12px;color:var(--tx2);margin-bottom:8px">${esc(f.resumen)}</div>
      <div class="out-box" style="max-height:none">${nl2br(f.contenido)}</div>
      <div style="margin-top:6px">${(f.tags||[]).map(t=>`<span style="font-size:9px;color:var(--tx3);background:var(--bgs);padding:1px 6px;border-radius:8px;margin-right:3px">#${esc(t)}</span>`).join('')}</div>
    </div>`).join('')}`;
}

// =============================================================
//  CAMPAÑAS
// =============================================================
function renderCampanias(){
  const el = $('#v-campanias');
  const list = DATA.campanias || [];
  el.innerHTML = `${viewHead('Campañas Activas')}${list.map(c=>`
    <div class="fb" style="${c.vigente?'border-left:3px solid var(--ok)':'opacity:.7'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:14px">${esc(c.titulo)}</strong>
        <span class="badge ${c.vigente?'vig':''}">${c.vigente?(c.permanente?'Permanente':(c.desde?`${esc(c.desde)} → ${esc(c.hasta)}`:'Vigente')):'Por definir'}</span>
      </div>
      <div style="font-size:12px;color:var(--tx2);margin-top:6px;line-height:1.6">${esc(c.resumen||'')}</div>
      ${c.guion?`<div style="font-size:11px;color:var(--tx3);margin-top:6px"><i class="fas fa-book"></i> Guion: ${esc(c.guion)}</div>`:''}
      ${c.link?`<a href="${esc(c.link)}" target="_blank" class="btn btn-gh" style="margin-top:8px"><i class="fas fa-link"></i> ${esc(c.link)}</a>`:''}
    </div>`).join('')}`;
}

// =============================================================
//  CLIENTES VIP
// =============================================================
function renderVip(){
  const el = $('#v-vip');
  const list = DATA.vip || [];
  el.innerHTML = `
    ${viewHead('Clientes VIP', `<span class="badge" style="background:rgba(180,83,9,.1);color:var(--gd)"><i class="fas fa-crown"></i> ${list.length} prioritarios</span>`)}
    <div class="al wr"><i class="fas fa-triangle-exclamation"></i><div><strong>Regla:</strong> verificar SIEMPRE antes de atender. Si el cliente está en esta lista, escalar al coordinador.</div></div>
    <div class="fb"><table class="tbl"><thead><tr><th>Cliente</th><th>Placa</th><th>Nota</th><th>Contacto</th></tr></thead><tbody>
      ${list.map(v=>`<tr><td><i class="fas fa-crown" style="color:var(--gd);font-size:10px"></i> <strong>${esc(v.nombre)}</strong></td><td style="font-family:var(--fm)">${esc(v.placa||'—')}</td><td style="font-size:11px;color:var(--tx3)">${esc(v.nota||'')}</td><td style="font-family:var(--fm);font-size:11px">${esc(v.tel||'')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// =============================================================
//  CASOS INTERNOS — formulario de radicación + bandeja con SLA
// =============================================================
function tiempoTranscurrido(ts){
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min/60); return `${h}h ${min%60}min`;
}
// Estructura de la vista: el FORMULARIO se renderiza una sola vez (no se toca en
// los refrescos) y la BANDEJA vive en su propio contenedor que sí se refresca.
function renderInternos(){
  const el = $('#v-internos');
  // Si la estructura ya existe (mismo usuario), solo refrescamos la bandeja para
  // no destruir el formulario que el asesor pueda estar llenando.
  if (el.dataset.built === '1') { renderBandeja(); return; }

  const ti = DATA.internos;
  el.innerHTML = `
    <div id="internosHead"></div>

    <div class="fb">
      <div class="bt val" style="margin-bottom:10px"><span class="n"><i class="fas fa-plus"></i></span>Radicar nuevo caso</div>
      <div class="rr"><div class="ff"><label>Tipo</label><select id="inTipo">${ti.tiposRadicacion.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div><div class="ff"><label>Placa</label><input id="inPlaca" class="mono" placeholder="ABC123" style="text-transform:uppercase"></div></div>
      <div class="rr"><div class="ff"><label>Nombre</label><input id="inNombre" placeholder="Sr./Sra."></div><div class="ff"><label>Teléfono</label><input id="inTelefono" placeholder="300 000 0000"></div></div>
      <div class="rr"><div class="ff"><label>Ciudad</label><select id="inCiudad"><option>Manizales</option><option>Pereira</option><option>Armenia</option><option>La Dorada</option><option>Cartago</option></select></div><div class="ff"><label>Tipo de servicio</label><select id="inServicio">${ti.tiposServicio.map(s=>`<option data-cola="${s.cola}">${esc(s.nombre)}</option>`).join('')}</select></div></div>
      <div class="rr full"><div class="ff"><label>Grupo de chat origen</label><select id="inGrupo">${ti.gruposChat.map(g=>`<option>${esc(g)}</option>`).join('')}</select></div></div>
      <div class="rr full"><div class="ff"><label>Nota del solicitante (contexto)</label><input id="inNota" placeholder="Lo que escribió el asesor de piso…"></div></div>
      <div id="inAutoAviso"></div>
      <div id="inDupAviso"></div>
      <button class="btn btn-ac btn-big" id="inRadicar" style="margin-top:10px"><i class="fas fa-shuffle"></i> Radicar y asignar</button>
    </div>

    ${can('config') ? `<div class="fb">
      <div class="bt say" style="margin-bottom:8px"><span class="n"><i class="fas fa-file-csv"></i></span>Carga masiva (CSV)</div>
      <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Sube un archivo .csv y el sistema asignará cada caso por la rotación aleatoria (mismas reglas). Columnas requeridas:</div>
      <div class="out-box mono" style="margin-bottom:8px">placa,nombre,telefono,ciudad,servicio,grupoChat,nota</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input type="file" id="csvFile" accept=".csv,text/csv" style="font-size:11px">
        <button class="btn btn-gh" id="csvPlantilla"><i class="fas fa-download"></i> Descargar plantilla</button>
      </div>
      <div id="csvResultado" style="margin-top:8px"></div>
    </div>` : ''}

    <div class="sub-l" style="margin-top:16px"><i class="fas fa-bell"></i>Bandeja de pendientes</div>
    <div id="internosBandeja"></div>`;
  el.dataset.built = '1';

  // Listeners del FORMULARIO (se enlazan una sola vez; no se vuelven a tocar).
  $('#inPlaca').addEventListener('input', renderDupAviso);
  $('#inPlaca').addEventListener('change', autocompletarRadicacion);
  $('#inRadicar').addEventListener('click', radicarCaso);
  const csvF = $('#csvFile'); if (csvF) csvF.addEventListener('change', procesarCSV);
  const csvP = $('#csvPlantilla'); if (csvP) csvP.addEventListener('click', descargarPlantillaCSV);

  renderBandeja();
}

// Descarga una plantilla CSV de ejemplo para la carga masiva.
function descargarPlantillaCSV(){
  const contenido = 'placa,nombre,telefono,ciudad,servicio,grupoChat,nota\n' +
    'ABC123,Sr. Juan Pérez,3001112233,Pereira,Mantenimiento,Citas Taller,Cliente pide cita esta semana\n' +
    'XYZ789,Sra. Ana Ruiz,3014445566,Manizales,Garantía,G Manizales,Revisar ruido motor';
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'plantilla_casos_internos.csv'; a.click();
  toast('Plantilla descargada');
}

// Procesa el CSV: radica los casos UNO POR UNO contra Supabase, con progreso.
// Las filas que fallan se reportan para corregir y volver a cargar.
function procesarCSV(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const out = $('#csvResultado');
  const reader = new FileReader();
  reader.onload = async () => {
    const filas = parseCSV(String(reader.result || ''));
    if (!filas.length) { out.innerHTML = `<div class="al wr" style="font-size:11px;padding:8px"><i class="fas fa-triangle-exclamation"></i><div>El archivo está vacío o no tiene filas válidas.</div></div>`; return; }
    const requeridas = ['placa','nombre','ciudad','servicio'];
    const errores = [];
    let creados = 0;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const falta = requeridas.filter(k => !(f[k] && f[k].trim()));
      if (falta.length) { errores.push(`Fila ${i+2}: falta ${falta.join(', ')}`); continue; }
      out.innerHTML = `<div class="al in" style="font-size:11px;padding:8px"><i class="fas fa-spinner fa-spin"></i><div>Radicando ${i+1}/${filas.length}…</div></div>`;
      try {
        await crearCasoInterno({
          tipoRadicacion: 'Nuevo',
          placa: f.placa.toUpperCase().trim(),
          nombre: f.nombre.trim(),
          telefono: (f.telefono||'').trim(),
          ciudad: (f.ciudad||'').trim(),
          servicio: (f.servicio||'').trim(),
          grupoChat: (f.grupochat||'').trim(),
          notaSolicitante: (f.nota||'').trim()
        }, { masivo: true });
        creados++;
      } catch (err) {
        errores.push(`Fila ${i+2}: no se pudo guardar (${err.message || 'error de conexión'})`);
      }
    }
    e.target.value = '';   // permite recargar el mismo archivo
    renderBandeja(); updateInternosBadges();

    out.innerHTML = `<div class="al ${errores.length?'wr':'in'}" style="font-size:11px;padding:8px"><i class="fas fa-circle-check"></i><div><strong>${creados} casos radicados y asignados.</strong>${errores.length?`<br>${errores.length} filas con error (corrígelas y vuelve a cargar solo esas):<br>${errores.slice(0,5).map(esc).join('<br>')}${errores.length>5?'<br>…':''}`:''}</div></div>`;
  };
  reader.readAsText(file, 'UTF-8');
}

// Parser CSV simple (soporta comas dentro de comillas y separador , o ;).
function parseCSV(texto){
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return [];
  const sep = (lineas[0].split(';').length > lineas[0].split(',').length) ? ';' : ',';
  const corta = (linea) => {
    const out = []; let cur = '', dentro = false;
    for (let i=0;i<linea.length;i++){ const c=linea[i];
      if (c === '"') { if (dentro && linea[i+1] === '"') { cur+='"'; i++; } else dentro = !dentro; }
      else if (c === sep && !dentro) { out.push(cur); cur=''; }
      else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const cab = corta(lineas[0]).map(h => h.toLowerCase());
  return lineas.slice(1).map(l => {
    const vals = corta(l); const o = {};
    cab.forEach((h,i) => o[h] = vals[i] || '');
    return o;
  });
}

// Refresca SOLO el encabezado (contador) y el listado de pendientes.
// Nunca toca el formulario de creación de arriba.
function renderBandeja(){
  const head = $('#internosHead');
  const cont = $('#internosBandeja');
  if (!cont) return;   // vista aún no construida
  const pend = casosPendientes();
  const sla = DATA.internos.slaMinutos;
  if (head) head.innerHTML = viewHead('Casos Internos CETA', `<span class="badge"><i class="fas fa-inbox"></i> ${pend.length} pendientes</span>`);
  cont.innerHTML = pend.length ? pend.map(g => {
    const min = Math.floor((Date.now() - (g._ts||0))/60000);
    const rojo = min >= sla;
    return `<div class="fb caso-row" data-id="${esc(g.id)}" style="cursor:pointer;border-left:3px solid ${RESULT_COLOR.pendiente}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <strong style="font-size:13px">${esc(g.nombre||'Sin nombre')}</strong> · <span style="font-family:var(--fm)">${esc(g.placa||'—')}</span>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(g.servicio||'—')} · Cola ${esc(g.cola||'—')} · ${esc(g.ciudad||'')}${hayAlertasCiudad(g.ciudad)?` <i class="fas fa-triangle-exclamation" style="color:var(--wr)" title="Esta ciudad tiene alertas operativas activas"></i>`:''} · ${esc(g.grupoChat||'')}</div>
          <div style="font-size:11px;margin-top:3px"><i class="fas fa-user-check" style="color:var(--ac)"></i> Asignado: <strong>${esc(g.asignadoAlias||'—')}</strong> <span style="color:var(--tx3)">(${esc(g.asignMotivo||'')})</span></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <span class="caso-timer" style="font-family:var(--fm);font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;background:${rojo?'var(--wrs)':'var(--bgs)'};color:${rojo?'var(--wr)':'var(--tx2)'}"><i class="fas fa-clock"></i> ${tiempoTranscurrido(g._ts||0)}</span>
        </div>
      </div>
      ${g.notaSolicitante?`<div class="al in" style="margin-top:8px;font-size:11px"><i class="fas fa-quote-left"></i><div>${esc(g.notaSolicitante)}</div></div>`:''}
      <button class="btn btn-ok caso-gestionar" data-id="${esc(g.id)}" style="margin-top:8px"><i class="fas fa-headset"></i> Gestionar caso</button>
    </div>`;
  }).join('') : emptyState('fa-check-circle','Sin pendientes','No hay casos pendientes por gestionar.');

  $$('#internosBandeja .caso-gestionar').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); gestionarCaso(b.dataset.id); }));
  $$('#internosBandeja .caso-row').forEach(r => r.addEventListener('click', () => gestionarCaso(r.dataset.id)));
}

function renderDupAviso(){
  const box = $('#inDupAviso'); if (!box) return;
  const placa = ($('#inPlaca').value||'').toUpperCase().trim();
  const dup = placa ? casoAbiertoPorPlaca(placa) : null;
  if (!dup) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="al wr" style="margin-top:8px;font-size:11px"><i class="fas fa-triangle-exclamation"></i><div>
    Esta placa ya tiene un caso abierto con <strong>${esc(dup.asignadoAlias||dup.asesorCeta||'—')}</strong> desde ${esc(fmtFechaHora(dup._ts))} (${esc(RESULT_LABEL[dup.resultado]||dup.resultado)}).</div></div>`;
}

// Autocompletado por placa (spec autocompletar-radicacion-por-placa): al
// salir del campo placa se busca la ficha y se llenan SOLO los campos
// vacíos; si falla la búsqueda no pasa nada (se digita a mano como siempre).
async function autocompletarRadicacion(){
  const box = $('#inAutoAviso'); if (box) box.innerHTML = '';
  if (!supabaseEnabled) return;
  const placa = ($('#inPlaca')?.value || '').toUpperCase().trim();
  if (placa.length < 5) return;
  let ficha = null;
  try { ficha = await sbFichaPorPlaca(placa); } catch (e) { console.warn('[CETA] fichaPorPlaca', e); return; }
  if (!ficha) return;
  if (($('#inPlaca')?.value || '').toUpperCase().trim() !== placa) return;   // el asesor cambió la placa mientras cargaba
  const llenados = [];
  const nom = $('#inNombre');   if (nom && !nom.value.trim() && ficha.nombre)   { nom.value = ficha.nombre;   llenados.push('nombre'); }
  const tel = $('#inTelefono'); if (tel && !tel.value.trim() && ficha.telefono) { tel.value = ficha.telefono; llenados.push('teléfono'); }
  const ciu = $('#inCiudad');
  if (ciu && ciu.selectedIndex <= 0 && ficha.ciudad && [...ciu.options].some(o => o.value === ficha.ciudad || o.text === ficha.ciudad)) {
    ciu.value = ficha.ciudad; llenados.push('ciudad');
  }
  if (llenados.length && box) {
    box.innerHTML = `<div class="al in" style="margin-top:8px;font-size:11px"><i class="fas fa-wand-magic-sparkles"></i><div>Datos traídos de la ficha de <strong>${esc(ficha.placa)}</strong> (${llenados.join(', ')}) — verifica y corrige si algo cambió.</div></div>`;
  }
}

function radicarCaso(){
  const placa = ($('#inPlaca').value||'').toUpperCase().trim();
  const nombre = ($('#inNombre').value||'').trim();
  if (!placa || !nombre) { toast('Placa y nombre son obligatorios'); return; }
  const servicio = $('#inServicio').value;
  const payload = {
    tipoRadicacion: $('#inTipo').value, placa, nombre,
    telefono: ($('#inTelefono').value||'').trim(),
    ciudad: $('#inCiudad').value, servicio,
    grupoChat: $('#inGrupo').value,
    notaSolicitante: ($('#inNota').value||'').trim()
  };
  // Verificación de duplicados: caso abierto por placa → ofrecer 2 opciones
  const dup = casoAbiertoPorPlaca(placa);
  if (dup) {
    modalOpen(`
      <div class="modal-head"><h3><i class="fas fa-triangle-exclamation" style="color:var(--wr)"></i> Placa con caso abierto</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
      <div class="modal-body">
        <div class="al wr" style="font-size:12px"><i class="fas fa-triangle-exclamation"></i><div>Esta placa ya tiene un caso abierto con <strong>${esc(dup.asignadoAlias||dup.asesorCeta||'—')}</strong> desde ${esc(fmtFechaHora(dup._ts))} (${esc(RESULT_LABEL[dup.resultado]||dup.resultado)}).</div></div>
        <p style="font-size:12px;color:var(--tx2);margin-top:10px">¿Desea agregar una nota al caso existente o crear uno nuevo de todas formas?</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-gh" id="dupNota"><i class="fas fa-pen"></i> Agregar nota al existente</button>
        <button class="btn btn-ac" id="dupCrear"><i class="fas fa-plus"></i> Crear de todos modos</button>
      </div>`);
    $('#dupCrear').addEventListener('click', () => { modalClose(); crearCasoInterno(payload).catch(err => { console.error(err); toast('⚠️ No se pudo radicar el caso — reintenta'); }); });
    $('#dupNota').addEventListener('click', () => { modalClose(); openCaseDetail(dup.id); });
    return;
  }
  crearCasoInterno(payload).catch(err => { console.error(err); toast('⚠️ No se pudo radicar el caso — reintenta'); });
}

// opciones.masivo = true → NO toca la UI (lo hace el llamador). Escribe el
// caso directamente en Supabase (estado 'pendiente'). Lanza Error si falla.
// grupoChat/notaSolicitante/tipoRadicacion van en sus columnas propias; si
// hay grupo_chat, la base dispara la alerta al espacio de Google Chat.
async function crearCasoInterno(payload, opciones){
  opciones = opciones || {};
  const asign = asignarCaso(payload.placa, payload.servicio);
  const p = {
    ...payload,
    origen: 'Interno',
    resultado: '',                       // sin resultado → estado 'pendiente'
    asignadoId: asign.asesorId, asignMotivo: asign.motivo, cola: asign.cola,
    historial: [{ ts: new Date().toISOString(), tipo: 'Creado', autor: S.user?.alias || '', resultado: 'pendiente', nota: `Radicado por ${S.user?.alias||'—'} → asignado a ${asign.alias} (${asign.motivo})` }]
  };
  const fila = await sbGuardarGestion(p, S.user);
  fila.asignadoAlias = asign.alias; fila.asesorCeta = asign.alias; fila.createdByAlias = asign.alias;
  insertarEnCache(fila);
  if (opciones.masivo) return fila;
  toast(`✅ Caso asignado a ${asign.alias} · ${asign.motivo}`);
  limpiarFormInternos();
  renderBandeja(); updateInternosBadges();   // refresca solo el listado, no el formulario
  return fila;
}

// Limpia los campos del formulario de radicación tras crear un caso.
function limpiarFormInternos(){
  ['inPlaca','inNombre','inTelefono','inNota'].forEach(id => { const e = $('#'+id); if (e) e.value = ''; });
  ['inTipo','inCiudad','inServicio','inGrupo'].forEach(id => { const e = $('#'+id); if (e) e.selectedIndex = 0; });
  const av = $('#inDupAviso'); if (av) av.innerHTML = '';
  const aa = $('#inAutoAviso'); if (aa) aa.innerHTML = '';
}

// Abrir un caso pendiente → precargar el Panel de Cierre con sus datos.
function gestionarCaso(id){
  const g = getGestionesLocal().find(x => x.id === id);
  if (!g) { toast('Caso no encontrado'); return; }
  if (!canEditCase(g)) { toast('Este caso está asignado a ' + (g.asignadoAlias||'otro asesor')); openCaseDetail(id); return; }
  S.casoActivo = id;
  precargarPanel(g);
  toast('Caso precargado en el panel →');
}

function updateInternosBadges(){
  const n = casosPendientes().length;
  // badge en sidebar
  let badge = $('#internosBadge');
  const nav = $('.ni[data-v="internos"]');
  if (nav && !badge) {
    badge = document.createElement('span');
    badge.id = 'internosBadge';
    badge.style.cssText = 'margin-left:auto;background:var(--ac);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 4px';
    nav.appendChild(badge);
  }
  if (badge) badge.style.display = n ? 'grid' : 'none', badge.textContent = n;
  // banner en Home
  const banner = $('#homePendientes');
  if (banner) {
    if (n > 0) { banner.style.display = 'flex'; banner.querySelector('.hp-n').textContent = n; }
    else banner.style.display = 'none';
  }
}

// =============================================================
//  CONTROL DE GESTIÓN (coordinador/analista) + Modo TV
// =============================================================
const RESULT_LABEL = { pendiente:'Pendiente', agenda:'Agendado', seg:'Seguimiento', comunica:'Se comunica', noc:'No contesta', sinKm:'Sin km', otroTaller:'Otro taller', actualizar:'Actualizar datos', noContactar:'No contactar', companero:'Gestión de compañero' };
const RESULT_COLOR = { pendiente:'#a855f7', agenda:'var(--ok)', seg:'var(--in)', comunica:'#0891b2', noc:'var(--wr)', sinKm:'var(--gd)', otroTaller:'var(--tx3)', actualizar:'#7c3aed', noContactar:'var(--ac)', companero:'#0d9488' };
// Rango por defecto del tablero: últimos 7 días (fecha de radicación).
function ctrlRangoDefecto(){
  const hoy = new Date(); const d = new Date(); d.setDate(hoy.getDate() - 6);
  const iso = x => x.toISOString().slice(0, 10);
  return { desde: iso(d), hasta: iso(hoy) };
}
let ctrlFiltro = { asesor:'', resultado:'', ...ctrlRangoDefecto() };
// Resultado de la consulta por rango a Supabase (spec filtro-fecha-radicacion):
// clave = 'desde|hasta' consultada; rows = gestiones del rango; error para el aviso.
let ctrlRango = { clave:'', rows:null, cargandoClave:'', error:'' };
const CTRL_TOPE = 2000;

// Columnas configurables del Control de Gestión (coordinador).
// 'def' = visible por defecto. El render() las pinta en este orden.
const CTRL_COLUMNS = [
  { key:'hora',        label:'Radicado',      def:true,  render: g => `<span style="font-family:var(--fm);font-size:11px">${esc(fmtFechaHora(g._ts))}</span>` },
  { key:'origen',      label:'Origen',        def:true,  render: g => esc(g.origen||'Inbound') },
  { key:'asesor',      label:'Asesor',        def:true,  render: g => esc(g.asignadoAlias||g.asesorCeta||'—') },
  { key:'placa',       label:'Placa',         def:true,  render: g => `<span style="font-family:var(--fm)">${esc(g.placa||'—')}</span>` },
  { key:'cliente',     label:'Cliente',       def:true,  render: g => esc(g.nombre||'—') },
  { key:'telefono',    label:'Teléfono',      def:false, render: g => `<span style="font-family:var(--fm);font-size:11px">${esc(g.telefono||'—')}</span>` },
  { key:'ciudad',      label:'Ciudad',        def:false, render: g => esc(g.ciudad||'—') },
  { key:'servicio',    label:'Servicio',      def:false, render: g => esc(g.servicio||'—') },
  { key:'asesorTaller',label:'Asesor servicio',def:false, render: g => esc(g.asesorTaller||'—') },
  { key:'resultado',   label:'Resultado',     def:true,  render: g => `<span class="tag" style="background:${RESULT_COLOR[g.resultado]||'var(--bgs)'}22;color:${RESULT_COLOR[g.resultado]||'var(--tx2)'}">${esc(RESULT_LABEL[g.resultado]||g.resultado||'—')}</span>` },
  { key:'actualizado', label:'Últ. actualización', def:false, render: g => `<span style="font-family:var(--fm);font-size:11px">${esc(g._updated && g._updated!==g._ts ? fmtFechaHora(g._updated) : '—')}</span>` }
];
const LS_CTRL_COLS = 'ceta_ctrl_cols';
function getCtrlCols(){
  // Asesores/analista: vista fija por defecto. Solo el coordinador personaliza.
  if (!can('config')) return CTRL_COLUMNS.filter(c => c.def).map(c => c.key);
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CTRL_COLS) || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return CTRL_COLUMNS.filter(c => c.def).map(c => c.key);
}
function setCtrlCols(keys){ localStorage.setItem(LS_CTRL_COLS, JSON.stringify(keys)); }
function resetCtrlCols(){ localStorage.removeItem(LS_CTRL_COLS); }

function gestionesVisibles(){
  let rows = getGestionesLocal();
  const p = perms();
  // asesores solo ven las propias
  if (p.controlGestion === 'propios') rows = rows.filter(g => g.asesorCeta === S.user.alias);
  return rows;
}

// =============================================================
//  VISTA ALERTAS OPERATIVAS (CRUD — solo coordinador)
// =============================================================
let alertaEditId = null;
function onAlertaTipo(){
  $('#alFechasWrap').classList.toggle('hidden', $('#alTipo').value !== 'temporal');
}
function togAlCiudad(b){
  const c = b.dataset.ciudad;
  if (c === 'Todas') {
    // "Todas" es exclusivo: al activarlo, apaga las demás
    $$('#alCiudades .pill').forEach(p => p.classList.toggle('on', p.dataset.ciudad === 'Todas'));
  } else {
    $('#alCiudades .pill[data-ciudad="Todas"]')?.classList.remove('on');
    b.classList.toggle('on');
    // si no quedó ninguna marcada, reactivar "Todas"
    if (!$$('#alCiudades .pill.on').length) $('#alCiudades .pill[data-ciudad="Todas"]')?.classList.add('on');
  }
}
function ciudadesSeleccionadas(){
  return $$('#alCiudades .pill.on').map(p => p.dataset.ciudad);
}
function limpiarFormAlerta(){
  alertaEditId = null;
  $('#alFormTitulo').textContent = 'Nueva alerta';
  $('#alTitulo').value = ''; $('#alDesc').value = '';
  $('#alPrioridad').value = 'alta'; $('#alTipo').value = 'permanente';
  $('#alFechaInicio').value = ''; $('#alFechaFin').value = '';
  $$('#alCiudades .pill').forEach(p => p.classList.toggle('on', p.dataset.ciudad === 'Todas'));
  onAlertaTipo();
  $('#alGuardar').innerHTML = '<i class="fas fa-floppy-disk"></i> Crear alerta';
  $('#alCancelar').classList.add('hidden');
}
function renderAlertas(){
  if (!can('config')) return;
  // listeners del formulario (una vez por render)
  $('#alGuardar').onclick = guardarAlerta;
  $('#alCancelar').onclick = limpiarFormAlerta;
  // lista
  const cont = $('#alertasLista');
  const list = getAlertas();
  if (!list.length) { cont.innerHTML = emptyState('fa-bell-slash','Sin alertas','Crea la primera alerta operativa con el formulario de arriba.'); return; }
  const orden = list.slice().sort((a,b)=> (b.activa-a.activa) || (PRIORIDAD_ORDEN[a.prioridad]-PRIORIDAD_ORDEN[b.prioridad]) || (b.id-a.id));
  cont.innerHTML = orden.map(a => {
    const c = ALERTA_COLOR[a.prioridad] || ALERTA_COLOR.informativa;
    const ciudades = (a.ciudades||[]).join(', ');
    const vig = a.tipo === 'temporal' ? `${esc(a.fechaInicio||'—')} → ${esc(a.fechaFin||'—')}` : 'Permanente';
    const vencida = a.tipo==='temporal' && a.fechaFin && a.fechaFin < hoyISO();
    return `<div class="fb" style="${a.activa?`border-left:3px solid ${c.bd}`:'opacity:.55'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <span class="tag" style="background:${c.bg};color:${c.tx}">${c.lbl}</span>
          <strong style="font-size:13px;margin-left:4px">${esc(a.titulo)}</strong>
          ${!a.activa?`<span class="badge" style="margin-left:4px">${vencida?'Vencida':'Inactiva'}</span>`:''}
          <div style="font-size:11px;color:var(--tx2);margin-top:4px">${esc(a.descripcion||'')}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:4px"><i class="fas fa-location-dot"></i> ${esc(ciudades)} · ${esc(vig)} · creó ${esc(a.creadoPor||'—')} (${esc(a.creadoEl||'')})</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-gh al-edit" data-id="${a.id}" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="btn btn-gh al-toggle" data-id="${a.id}" title="${a.activa?'Desactivar':'Activar'}"><i class="fas fa-power-off" style="color:${a.activa?'var(--ok)':'var(--tx3)'}"></i></button>
          <button class="btn btn-gh al-del" data-id="${a.id}" title="Eliminar"><i class="fas fa-trash" style="color:var(--ac)"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
  $$('#alertasLista .al-edit').forEach(b => b.addEventListener('click', () => editarAlerta(+b.dataset.id)));
  $$('#alertasLista .al-toggle').forEach(b => b.addEventListener('click', () => {
    const l = getAlertas(); const a = l.find(x=>x.id===+b.dataset.id); if (a){ a.activa=!a.activa; saveAlertas(l); renderAlertas(); refrescarAlertasUI(); toast(a.activa?'Alerta activada':'Alerta desactivada'); }
  }));
  $$('#alertasLista .al-del').forEach(b => b.addEventListener('click', () => {
    const a = getAlertas().find(x=>x.id===+b.dataset.id); if(!a) return;
    confirmModal('Eliminar alerta', `¿Eliminar la alerta <strong>${esc(a.titulo)}</strong>?`, () => {
      saveAlertas(getAlertas().filter(x=>x.id!==a.id)); renderAlertas(); refrescarAlertasUI(); toast('Alerta eliminada');
    });
  }));
}
function guardarAlerta(){
  const titulo = $('#alTitulo').value.trim();
  if (!titulo) { toast('El título es obligatorio'); return; }
  const tipo = $('#alTipo').value;
  const ciudades = ciudadesSeleccionadas();
  if (!ciudades.length) { toast('Selecciona al menos una ciudad'); return; }
  if (tipo === 'temporal') {
    const fi = $('#alFechaInicio').value, ff = $('#alFechaFin').value;
    if (!fi || !ff) { toast('Una alerta temporal requiere fecha inicio y fin'); return; }
    if (ff < fi) { toast('La fecha fin no puede ser anterior a la de inicio'); return; }
  }
  const datos = {
    titulo, descripcion: $('#alDesc').value.trim(), ciudades,
    tipo, prioridad: $('#alPrioridad').value,
    fechaInicio: tipo==='temporal' ? $('#alFechaInicio').value : null,
    fechaFin: tipo==='temporal' ? $('#alFechaFin').value : null
  };
  const list = getAlertas();
  if (alertaEditId) {
    const a = list.find(x=>x.id===alertaEditId);
    if (a) Object.assign(a, datos);
    toast('Alerta actualizada ✓');
  } else {
    list.unshift({ id: Date.now(), ...datos, activa: true, creadoPor: S.user?.alias || '', creadoEl: hoyISO() });
    toast('Alerta creada ✓');
  }
  saveAlertas(list);
  limpiarFormAlerta();
  renderAlertas();
  refrescarAlertasUI();
}
function editarAlerta(id){
  const a = getAlertas().find(x=>x.id===id); if (!a) return;
  alertaEditId = id;
  $('#alFormTitulo').textContent = 'Editar alerta';
  $('#alTitulo').value = a.titulo; $('#alDesc').value = a.descripcion||'';
  $('#alPrioridad').value = a.prioridad; $('#alTipo').value = a.tipo;
  $('#alFechaInicio').value = a.fechaInicio||''; $('#alFechaFin').value = a.fechaFin||'';
  $$('#alCiudades .pill').forEach(p => p.classList.toggle('on', (a.ciudades||[]).includes(p.dataset.ciudad)));
  onAlertaTipo();
  $('#alGuardar').innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
  $('#alCancelar').classList.remove('hidden');
  $('#v-alertas').scrollTop = 0;
}

// Refresca todos los puntos donde se muestran alertas (panel, home, bandeja).
function refrescarAlertasUI(){
  renderPanelAlertas();
  renderHomeAlertas();
  if ($('#v-internos')?.dataset.built === '1') renderBandeja();
}

// Bloque de alertas en el PANEL de cierre, según la ciudad seleccionada.
function renderPanelAlertas(){
  const box = $('#panelAlertas'); if (!box) return;
  const ciudad = ($('[data-f="ciudad"]')?.value || '').trim();
  const alertas = ordenarPorPrioridad(alertasDeCiudad(ciudad));
  box.innerHTML = alertas.length
    ? `<div class="rp-s" style="padding-top:2px">${alertas.map(a => alertaCard(a, true)).join('')}</div>`
    : '';
}

// Banners de alertas en el HOME (alta arriba, media/informativa abajo).
function renderHomeAlertas(){
  const activas = getAlertas().filter(a => a.activa && (a.tipo!=='temporal' || (!a.fechaFin || a.fechaFin >= hoyISO()) && (!a.fechaInicio || a.fechaInicio <= hoyISO())));
  const alta = activas.filter(a => a.prioridad === 'alta');
  const otras = activas.filter(a => a.prioridad !== 'alta');
  const elAlta = $('#homeAlertasAlta'), elOtras = $('#homeAlertasOtras');
  if (elAlta) elAlta.innerHTML = alta.length ? alta.map(a=>alertaCard(a,false)).join('') : '';
  if (elOtras) elOtras.innerHTML = otras.length
    ? `<div style="font-family:var(--fd);font-size:11px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="fas fa-triangle-exclamation"></i>Alertas operativas</div>${ordenarPorPrioridad(otras).map(a=>alertaCard(a,false)).join('')}`
    : '';
}

function renderControl(){
  const el = $('#v-control');
  if (!perms().controlGestion) { el.innerHTML = emptyState('fa-lock','Control de Gestión','Tu rol no tiene acceso a esta vista.'); return; }
  // Rango por fecha de radicación: si está invertido, se corrige solo.
  if (ctrlFiltro.desde && ctrlFiltro.hasta && ctrlFiltro.desde > ctrlFiltro.hasta)
    [ctrlFiltro.desde, ctrlFiltro.hasta] = [ctrlFiltro.hasta, ctrlFiltro.desde];
  const claveRango = ctrlFiltro.desde + '|' + ctrlFiltro.hasta;
  let rows, rangoCargando = false;
  if (supabaseEnabled) {
    // La verdad del rango vive en Supabase, no en la caché local (con tope).
    if (ctrlRango.clave === claveRango && ctrlRango.rows) {
      rows = ctrlRango.rows;
    } else {
      rangoCargando = true;
      rows = ctrlRango.rows || gestionesVisibles();   // muestra lo último mientras carga
      if (ctrlRango.cargandoClave !== claveRango) {
        ctrlRango.cargandoClave = claveRango;
        sbListarGestiones({ desde: ctrlFiltro.desde + 'T00:00:00-05:00', hasta: ctrlFiltro.hasta + 'T23:59:59-05:00', limite: CTRL_TOPE })
          .then(rs => {
            if (ctrlRango.cargandoClave !== claveRango) return;   // cambió el rango mientras cargaba
            conAliases(rs);
            ctrlRango = { clave: claveRango, rows: rs, cargandoClave: '', error: '' };
            if ($('#v-control')?.classList.contains('active')) renderControl();
          })
          .catch(err => {
            console.error('[CETA] rango control', err);
            // Marca el rango como "consultado" con lo que había para no reintentar
            // en bucle; el botón Actualizar o cambiar el rango vuelven a consultar.
            ctrlRango = { clave: claveRango, rows: ctrlRango.rows || [], cargandoClave: '',
                          error: 'No se pudo consultar el rango — se muestra lo último cargado. Usa Actualizar para reintentar.' };
            if ($('#v-control')?.classList.contains('active')) renderControl();
          });
      }
    }
    const p = perms();
    if (p.controlGestion === 'propios') rows = rows.filter(g => g.asesorCeta === S.user.alias);
  } else {
    // Sin Supabase (local): filtrar la caché por fecha de radicación.
    const d0 = new Date(ctrlFiltro.desde + 'T00:00:00').getTime(), d1 = new Date(ctrlFiltro.hasta + 'T23:59:59').getTime();
    rows = gestionesVisibles().filter(g => g._ts >= d0 && g._ts <= d1);
  }
  const asesores = [...new Set(rows.map(g => g.asesorCeta).filter(Boolean))].sort();
  const fil = rows.filter(g =>
    (!ctrlFiltro.asesor || g.asesorCeta === ctrlFiltro.asesor) &&
    (!ctrlFiltro.resultado || g.resultado === ctrlFiltro.resultado));

  const total = fil.length;
  const agend = fil.filter(g => g.resultado === 'agenda').length;
  const noc = fil.filter(g => g.resultado === 'noc').length;
  const segc = fil.filter(g => g.resultado === 'seg').length;

  // contadores por asesor (balance de carga)
  const porAsesor = {};
  fil.forEach(g => { porAsesor[g.asesorCeta||'—'] = (porAsesor[g.asesorCeta||'—']||0)+1; });
  const maxA = Math.max(1, ...Object.values(porAsesor));

  el.innerHTML = `
    ${viewHead('Control de Gestión',
      `<span class="badge"><i class="fas fa-layer-group"></i> ${total} gestiones</span>${can('modoTV')?'<span class="badge"><i class="fas fa-tv"></i> Modo TV disponible</span>':''}`)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
      <div class="ff" style="min-width:130px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Radicado desde</label>
        <input type="date" id="ctrlDesde" value="${esc(ctrlFiltro.desde)}" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"></div>
      <div class="ff" style="min-width:130px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Hasta</label>
        <input type="date" id="ctrlHasta" value="${esc(ctrlFiltro.hasta)}" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"></div>
      <button class="btn btn-ac" id="ctrlAplicar" title="Consultar el rango elegido"><i class="fas fa-magnifying-glass"></i> Aplicar</button>
      <div class="ff" style="min-width:160px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Asesor</label>
        <select id="ctrlAsesor" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"><option value="">Todos</option>${asesores.map(a=>`<option ${ctrlFiltro.asesor===a?'selected':''}>${esc(a)}</option>`).join('')}</select></div>
      <div class="ff" style="min-width:160px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Resultado</label>
        <select id="ctrlResultado" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"><option value="">Todos</option>${Object.entries(RESULT_LABEL).map(([k,v])=>`<option value="${k}" ${ctrlFiltro.resultado===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <button class="btn btn-gh" id="ctrlClear"><i class="fas fa-filter-circle-xmark"></i> Limpiar</button>
      <div style="margin-left:auto;display:flex;gap:6px">
        ${supabaseEnabled?`<button class="btn btn-gh" id="ctrlSync" title="Traer las gestiones del equipo"><i class="fas fa-rotate"></i> Actualizar</button>`:''}
        ${can('config')?`<button class="btn btn-gh" id="ctrlCols" title="Configurar columnas"><i class="fas fa-gear"></i> Columnas</button>`:''}
        ${can('modoTV')?`<button class="btn btn-gh" id="ctrlTVCfg" title="Elegir qué paneles se proyectan"><i class="fas fa-sliders"></i> Paneles TV</button><button class="btn btn-ac" id="ctrlTV" title="Abrir la ventana del televisor"><i class="fas fa-tv"></i> Modo TV</button>`:''}
      </div>
    </div>
    ${rangoCargando ? `<div class="al in" style="margin-bottom:10px"><i class="fas fa-spinner fa-spin"></i><div>Consultando lo radicado del ${esc(ctrlFiltro.desde)} al ${esc(ctrlFiltro.hasta)}…</div></div>` : ''}
    ${ctrlRango.error && !rangoCargando ? `<div class="al wr" style="margin-bottom:10px"><i class="fas fa-triangle-exclamation"></i><div>${esc(ctrlRango.error)}</div></div>` : ''}
    ${!rangoCargando && supabaseEnabled && (ctrlRango.rows||[]).length >= CTRL_TOPE ? `<div class="al wr" style="margin-bottom:10px"><i class="fas fa-triangle-exclamation"></i><div>El rango supera ${CTRL_TOPE.toLocaleString('es-CO')} gestiones — se muestran las más recientes. Acorta el rango para ver todo.</div></div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      ${[['Total',total,''],['Agendados',agend,'var(--ok)'],['No contesta',noc,'var(--wr)'],['Seguimiento',segc,'var(--in)']].map(([l,n,c])=>
        `<div class="fb" style="text-align:center;padding:14px"><div style="font-family:var(--fd);font-weight:800;font-size:24px;${c?`color:${c}`:''}">${n}</div><div style="font-size:10px;color:var(--tx3);text-transform:uppercase">${l}</div></div>`).join('')}
    </div>
    ${Object.keys(porAsesor).length?`<div class="fb"><div class="bt val" style="margin-bottom:8px"><span class="n"><i class="fas fa-scale-balanced"></i></span>Balance de carga</div>
      ${Object.entries(porAsesor).sort((a,b)=>b[1]-a[1]).map(([a,n])=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px"><div style="width:90px;flex-shrink:0">${esc(a)}</div><div style="flex:1;background:var(--bgs);border-radius:4px;height:14px;overflow:hidden"><div style="width:${Math.round(n/maxA*100)}%;height:100%;background:var(--ac)"></div></div><div style="width:28px;text-align:right;font-family:var(--fm)">${n}</div></div>`).join('')}
    </div>`:''}
    ${(() => {
      const bal = balanceDelDia();
      const aliases = Object.keys(bal);
      if (!aliases.length) return '';
      return `<div class="fb"><div class="bt say" style="margin-bottom:8px"><span class="n"><i class="fas fa-shuffle"></i></span>Balance del día · Casos Internos</div>
        <table class="tbl"><thead><tr><th>Asesor</th><th style="text-align:center">Cola A<br><span style="font-size:8px;color:var(--tx3)">factura</span></th><th style="text-align:center">Cola B<br><span style="font-size:8px;color:var(--tx3)">no factura</span></th><th style="text-align:center">Total</th></tr></thead><tbody>
        ${aliases.map(al=>{const x=bal[al];const tot=x.A+x.B;return `<tr><td><strong>${esc(al)}</strong></td><td style="text-align:center;font-family:var(--fm)">${x.A}</td><td style="text-align:center;font-family:var(--fm)">${x.B}</td><td style="text-align:center;font-family:var(--fm);font-weight:700">${tot}</td></tr>`;}).join('')}
        </tbody></table>
        <div style="font-size:10px;color:var(--tx3);margin-top:6px"><i class="fas fa-circle-info"></i> Rotación en bloques de 5 · se reinicia cada día.</div>
      </div>`;
    })()}
    ${(() => {
      const hoyW = new Date().toISOString().slice(0,10);
      const wegos = getGestionesLocal()
        .filter(g => g.weGo === 'Sí' && g.wgFecha && g.wgFecha >= hoyW)
        .sort((a,b) => ((a.wgFecha||'')+(a.wgHora||'')).localeCompare((b.wgFecha||'')+(b.wgHora||'')));
      if (!wegos.length) return '';
      const porFecha = {};
      wegos.forEach(g => { (porFecha[g.wgFecha] = porFecha[g.wgFecha] || []).push(g); });
      const diaTxt = f => new Date(f + 'T00:00').toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'short' });
      return `<div class="fb"><div class="bt do" style="margin-bottom:8px"><span class="n"><i class="fas fa-truck-pickup"></i></span>We Go agendados (${wegos.length} próximos)</div>
        ${Object.entries(porFecha).map(([fecha, gs]) => `
          <div style="font-weight:700;font-size:11px;margin:8px 0 4px;color:var(--tx2);text-transform:capitalize">${esc(diaTxt(fecha))}</div>
          <table class="tbl"><thead><tr><th>Hora</th><th>Ciudad</th><th>Placa</th><th>Cliente</th><th>Recoge</th><th>Asesor</th></tr></thead><tbody>
          ${gs.map(g => `<tr class="ctrl-row" data-id="${esc(g.id)}" style="cursor:pointer"><td class="mono">${esc(g.wgHora||'—')}</td><td>${esc(g.ciudad||'—')}</td><td class="mono">${esc(g.placa||'—')}</td><td>${esc(g.nombre||'—')}</td><td>${esc(g.wgQuien||'—')}</td><td>${esc(g.asesorCeta||'—')}</td></tr>`).join('')}
          </tbody></table>`).join('')}
        <div style="font-size:10px;color:var(--tx3);margin-top:6px"><i class="fas fa-circle-info"></i> Antes de ofrecer una franja We Go, verifica aquí que no esté ocupada en esa ciudad. El panel también te lo advierte al agendar.</div>
      </div>`;
    })()}
    <div class="fb">
      ${fil.length?(() => {
        const cols = getCtrlCols().map(k => CTRL_COLUMNS.find(c=>c.key===k)).filter(Boolean);
        const esCoord = can('reasignar');
        return `<table class="tbl"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}${esCoord?'<th style="width:30px"></th>':''}<th style="width:24px"></th></tr></thead><tbody>
          ${fil.map(g=>`<tr class="ctrl-row" data-id="${esc(g.id)}" style="cursor:pointer">${cols.map(c=>`<td>${c.render(g)}</td>`).join('')}${esCoord?`<td><button class="btn btn-gh ctrl-reasignar" data-id="${esc(g.id)}" title="Reasignar a otro asesor" style="padding:3px 7px"><i class="fas fa-people-arrows"></i></button></td>`:''}<td style="color:var(--tx3)"><i class="fas fa-chevron-right" style="font-size:10px"></i></td></tr>`).join('')}
        </tbody></table>`;
      })():emptyState('fa-inbox','Sin gestiones','Aún no hay gestiones registradas. Las que guardes en el panel derecho aparecerán aquí.')}
    </div>
    ${graficasHTML(fil)}`;
  const a = $('#ctrlAsesor'); if (a) a.addEventListener('change', e => { ctrlFiltro.asesor = e.target.value; renderControl(); });
  const rr = $('#ctrlResultado'); if (rr) rr.addEventListener('change', e => { ctrlFiltro.resultado = e.target.value; renderControl(); });
  const cl = $('#ctrlClear'); if (cl) cl.addEventListener('click', () => { ctrlFiltro = { asesor:'', resultado:'', ...ctrlRangoDefecto() }; renderControl(); });
  // Las fechas NO consultan solas: se aplican con el botón (piloto #10).
  const ap = $('#ctrlAplicar'); if (ap) ap.addEventListener('click', () => {
    const def = ctrlRangoDefecto();
    ctrlFiltro.desde = $('#ctrlDesde')?.value || def.desde;
    ctrlFiltro.hasta = $('#ctrlHasta')?.value || def.hasta;
    renderControl();
  });
  const tv = $('#ctrlTV'); if (tv) tv.addEventListener('click', openModoTV);
  const tvc = $('#ctrlTVCfg'); if (tvc) tvc.addEventListener('click', openTVConfig);
  const cog = $('#ctrlCols'); if (cog) cog.addEventListener('click', openColsConfig);
  const syn = $('#ctrlSync'); if (syn) syn.addEventListener('click', () => {
    // Invalida el rango consultado para volver a pedirlo a Supabase.
    ctrlRango = { clave:'', rows: ctrlRango.rows, cargandoClave:'', error:'' };
    refrescarGestiones(); renderControl();
  });
  $$('#v-control .ctrl-reasignar').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openReasignar(b.dataset.id); }));
  $$('#v-control .ctrl-row').forEach(tr => tr.addEventListener('click', () => openCaseDetail(tr.dataset.id)));
}

// Trae las gestiones del Sheet (todo el equipo) y las fusiona con las locales por id.
// Sincronización BIDIRECCIONAL:
//  1) baja las del Sheet y las fusiona en local
//  2) sube al Sheet (uno por uno) las locales que aún no están allá
async function refrescarGestiones(opts){
  // Lectura desde Supabase (fuente de verdad). Patrón stale-while-revalidate:
  // la UI pinta primero la caché local y esta función la refresca en fondo.
  opts = opts || {};
  const silencioso = !!opts.silencioso;
  if (opts.throttle && Date.now() - (window._lastGesRefresh || 0) < 15000) return;
  window._lastGesRefresh = Date.now();
  try {
    const rows = await sbListarGestiones({ limite: 500 });
    conAliases(rows);
    setGestionesLocal(rows);
    // refrescar todo lo que depende de las gestiones
    if ($('#v-control')?.classList.contains('active')) renderControl();
    if ($('#v-internos')?.dataset.built === '1') renderBandeja();
    if ($('#v-home')?.classList.contains('active')) renderHome();
    updateInternosBadges();
    if (!silencioso) toast(`✅ Actualizado · ${rows.length} gestiones`);
  } catch (err) {
    console.error('[CETA] refrescarGestiones', err);
    if (!silencioso) toast('⚠️ No se pudieron traer las gestiones (revisa la conexión)');
  }
}

// Revalida SOLO los casos internos (bandeja): trae de Supabase los de
// origen 'interno' y los funde en la caché conservando el resto.
async function refrescarInternos(opts){
  opts = opts || {};
  if (opts.throttle && Date.now() - (window._lastIntRefresh || 0) < 15000) return;
  window._lastIntRefresh = Date.now();
  try {
    // Revalidar también las cachés de personas (mismo patrón): si el admin
    // activó/creó usuarios o asesores de taller en Supabase, aquí se entera.
    try { S.operadores = await listarOperadoresCasos(); } catch (e) { console.warn('[CETA] operadores', e); }
    try { S.asesoresCC = await listarAsesoresCC(); } catch (e) { console.warn('[CETA] asesoresCC', e); }
    try { S.asesoresTaller = await listarAsesoresTaller(); refrescarAsesoresTallerCache(); } catch (e) { console.warn('[CETA] asesoresTaller', e); }
    const internos = await sbListarCasosInternos({});
    conAliases(internos);
    const otros = getGestionesLocal().filter(g => g.origen !== 'Interno');
    setGestionesLocal([...internos, ...otros].sort((a,b)=>(b._ts||0)-(a._ts||0)));
    if ($('#v-internos')?.dataset.built === '1') renderBandeja();
    updateInternosBadges();
  } catch (err) {
    console.error('[CETA] refrescarInternos', err);
  }
}

// =============================================================
//  COLA DE SEGUIMIENTOS (spec 2026-07-24-cola-seguimientos)
//  Consulta dedicada: la cola es COMPLETA (no depende del tope de la
//  caché general). Asesores ven la suya; supervisión ve la del equipo.
// =============================================================
async function refrescarSeguimientos(opts){
  opts = opts || {};
  if (opts.throttle && Date.now() - (window._lastSegRefresh || 0) < 15000) return;
  window._lastSegRefresh = Date.now();
  try {
    const propios = perms().verCasos !== 'todos';
    const rows = await sbListarSeguimientos(propios ? { asesorId: S.user?.id } : {});
    conAliases(rows);
    rows.forEach(g => { g._segTs = g.segFecha ? new Date(`${g.segFecha}T${g.segHora || '00:00'}`).getTime() : 0; });
    S.seguimientos = rows;
    // fundirlos en la caché general para que el detalle y el panel los encuentren
    rows.forEach(reemplazarEnCache);
    updateSeguimientosBadge();
    if ($('#v-seguimientos')?.classList.contains('active')) renderSeguimientos();
  } catch (err) {
    console.error('[CETA] refrescarSeguimientos', err);
  }
}

// Clasifica la cola: vencidos (antes de hoy), hoy, próximos.
function clasificarSeguimientos(){
  const ahora = new Date();
  const iniHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const finHoy = iniHoy + 86400000;
  const vencidos = [], hoy = [], proximos = [];
  (S.seguimientos || []).forEach(g => {
    if (!g._segTs) return;
    if (g._segTs < iniHoy) vencidos.push(g);
    else if (g._segTs < finHoy) hoy.push(g);
    else proximos.push(g);
  });
  return { vencidos, hoy, proximos };
}

function updateSeguimientosBadge(){
  const { vencidos, hoy } = clasificarSeguimientos();
  const n = vencidos.length + hoy.length;
  let badge = $('#segBadge');
  const nav = $('.ni[data-v="seguimientos"]');
  if (nav && !badge) {
    badge = document.createElement('span');
    badge.id = 'segBadge';
    badge.style.cssText = 'margin-left:auto;background:var(--ac);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 4px';
    nav.appendChild(badge);
  }
  if (badge) { badge.style.display = n ? 'grid' : 'none'; badge.textContent = n; }
  const banner = $('#homeSeguimientos');
  if (banner) {
    if (n > 0) {
      const plural = perms().verCasos === 'todos';
      banner.style.display = 'flex';
      banner.querySelector('.hs-txt').textContent =
        `${plural ? 'El equipo tiene' : 'Tienes'} ${n} seguimiento${n === 1 ? '' : 's'} para hoy` +
        (vencidos.length ? ` (${vencidos.length} vencido${vencidos.length === 1 ? '' : 's'})` : '');
    } else banner.style.display = 'none';
  }
}

// Cuándo toca el seguimiento, en lenguaje humano según su grupo.
function segCuando(g, tipo){
  const conHora = g.segHora && g.segHora !== '00:00';
  if (tipo === 'vencido') {
    const dias = Math.max(1, Math.ceil((Date.now() - g._segTs) / 86400000));
    return `Vencido hace ${dias} día${dias === 1 ? '' : 's'}`;
  }
  if (tipo === 'hoy') return conHora ? `Hoy · ${g.segHora}` : 'Hoy · durante el día';
  const d = new Date(g._segTs);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) + (conHora ? ` · ${g.segHora}` : '');
}

function renderSeguimientos(){
  const el = $('#v-seguimientos'); if (!el) return;
  const { vencidos, hoy, proximos } = clasificarSeguimientos();
  const esEquipo = perms().verCasos === 'todos';
  const colorTipo = { vencido: 'var(--ac)', hoy: 'var(--in)', proximo: 'var(--tx3)' };
  const card = (g, tipo) => `
    <div class="fb seg-card" data-id="${esc(g.id)}" style="cursor:pointer;border-left:3px solid ${colorTipo[tipo]};display:flex;align-items:center;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <strong>${esc(g.nombre || 'Sin nombre')}</strong>
          <span class="mono" style="font-size:11px;color:var(--tx2)">${esc(g.placa || '—')}</span>
          <span style="font-size:11px;color:var(--tx2)"><i class="fas fa-phone" style="font-size:9px"></i> ${esc(g.telefono || '—')}</span>
          ${esEquipo ? `<span class="badge">${esc(g.asesorCeta || g.asignadoAlias || '—')}</span>` : ''}
        </div>
        <div style="font-size:11px;margin-top:3px;color:${tipo === 'vencido' ? 'var(--ac)' : 'var(--tx2)'};font-weight:${tipo === 'vencido' ? '700' : '500'}">
          <i class="fas fa-clock" style="font-size:9px"></i> ${esc(segCuando(g, tipo))}
        </div>
        ${g.segObs ? `<div style="font-size:11px;color:var(--tx3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.segObs)}</div>` : ''}
      </div>
      ${canEditCase(g) ? `<button class="btn btn-ac seg-gestionar" data-id="${esc(g.id)}" style="flex-shrink:0"><i class="fas fa-headset"></i> Gestionar en el panel →</button>` : ''}
      <i class="fas fa-chevron-right" style="color:var(--tx3);font-size:10px;flex-shrink:0"></i>
    </div>`;
  el.innerHTML = `
    <h1 class="ft-title">Seguimientos</h1>
    <div class="badges">
      <span class="badge" style="background:var(--acs);color:var(--ac)">${vencidos.length} vencidos</span>
      <span class="badge" style="background:var(--ins);color:var(--in)">${hoy.length} para hoy</span>
      <span class="badge">${proximos.length} próximos</span>
      ${esEquipo ? '<span class="badge"><i class="fas fa-users"></i> Cola del equipo</span>' : ''}
    </div>
    ${vencidos.length ? `<div class="sub-l" style="color:var(--ac)"><i class="fas fa-triangle-exclamation"></i>Vencidos (${vencidos.length})</div>${vencidos.map(g => card(g, 'vencido')).join('')}` : ''}
    ${hoy.length ? `<div class="sub-l" style="margin-top:14px"><i class="fas fa-sun"></i>Hoy (${hoy.length})</div>${hoy.map(g => card(g, 'hoy')).join('')}` : ''}
    ${(!vencidos.length && !hoy.length) ? emptyState('fa-circle-check', 'No tienes seguimientos pendientes', 'Cuando tipifiques una gestión en Seguimiento con fecha, aparecerá aquí en su día.') : ''}
    ${proximos.length ? `<div class="sub-l" style="margin-top:14px"><i class="fas fa-calendar"></i>Próximos (${proximos.length})</div>${proximos.map(g => card(g, 'proximo')).join('')}` : ''}`;
  $$('#v-seguimientos .seg-gestionar').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); gestionarCaso(b.dataset.id); }));
  $$('#v-seguimientos .seg-card').forEach(c => c.addEventListener('click', () => openCaseDetail(c.dataset.id)));
}
function goToSeguimientos(){ goTo('seguimientos'); }

// =============================================================
//  VISTA 360 — CLIENTES (spec 2026-07-24-vista-360-v1)
//  Ficha de SOLO consulta: siempre lee datos frescos de Supabase.
// =============================================================
function renderClientes(){
  const el = $('#v-clientes'); if (!el) return;
  if (el.dataset.built === '1') return;
  el.dataset.built = '1';
  el.innerHTML = `
    <h1 class="ft-title">Clientes — Vista 360</h1>
    <div class="badges"><span class="badge"><i class="fas fa-magnifying-glass"></i> Busca por placa o teléfono</span><span class="badge"><i class="fas fa-eye"></i> Historial completo del equipo</span></div>
    <div class="fb" style="display:flex;gap:8px;align-items:center">
      <input id="cliBuscar" placeholder="Placa (ABC123) o teléfono (3001234567)…" style="flex:1;border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:9px 12px;border-radius:7px;font-family:var(--f);font-size:13px">
      <button class="btn btn-ac" id="cliBuscarBtn"><i class="fas fa-magnifying-glass"></i> Buscar</button>
    </div>
    <div id="cliResultados"></div>
    <div id="cliFicha"></div>`;
  const doBuscar = () => buscarClientes360($('#cliBuscar').value);
  $('#cliBuscarBtn').addEventListener('click', doBuscar);
  $('#cliBuscar').addEventListener('keydown', e => { if (e.key === 'Enter') doBuscar(); });
}

async function buscarClientes360(termino){
  const out = $('#cliResultados'), ficha = $('#cliFicha');
  if (!termino || termino.trim().length < 3) { toast('Escribe al menos 3 caracteres'); return; }
  ficha.innerHTML = '';
  out.innerHTML = `<div class="al in"><i class="fas fa-spinner fa-spin"></i><div>Buscando…</div></div>`;
  try {
    const sugs = await sbSugerirClientes(termino);
    if (!sugs.length) {
      out.innerHTML = emptyState('fa-user-slash', `Sin resultados para "${esc(termino.trim())}"`, 'Verifica la placa o el teléfono. Si es un cliente nuevo, regístralo desde el panel al gestionar la llamada.');
      return;
    }
    if (sugs.length === 1) { out.innerHTML = ''; abrirFicha360(sugs[0]); return; }
    out.innerHTML = sugs.map((s, i) => `
      <div class="fb cli-sug" data-i="${i}" style="cursor:pointer;display:flex;align-items:center;gap:12px">
        <i class="fas fa-id-card" style="color:var(--ac)"></i>
        <div style="flex:1"><strong>${esc(s.nombre)}</strong>
          <div style="font-size:11px;color:var(--tx2)"><span class="mono">${esc(s.placa || '—')}</span>${s.telefono ? ' · ' + esc(s.telefono) : ''}</div></div>
        <i class="fas fa-chevron-right" style="color:var(--tx3);font-size:10px"></i>
      </div>`).join('');
    $$('#cliResultados .cli-sug').forEach(el2 => el2.addEventListener('click', () => { $('#cliResultados').innerHTML = ''; abrirFicha360(sugs[+el2.dataset.i]); }));
  } catch (err) {
    console.error('[CETA] buscarClientes360', err);
    out.innerHTML = `<div class="al wr"><i class="fas fa-triangle-exclamation"></i><div>Sin conexión — reintenta.</div></div>`;
  }
}

async function abrirFicha360(sug){
  goTo('clientes');
  const ficha = $('#cliFicha'); if (!ficha) return;
  $('#cliResultados').innerHTML = '';
  const inp = $('#cliBuscar'); if (inp && !inp.value) inp.value = sug.placa || sug.telefono || '';
  ficha.innerHTML = `<div class="al in"><i class="fas fa-spinner fa-spin"></i><div>Cargando ficha…</div></div>`;
  try {
    let cliente;
    if (sug.clienteId) {
      cliente = await sbObtenerCliente(sug.clienteId);
    } else if (sug.vehiculoId) {
      const v = await sbObtenerVehiculo(sug.vehiculoId);
      cliente = { id: null, nombre: 'Sin cliente asociado', telefono: '', ciudad: '', fecha_nacimiento: null, vehiculos: [v] };
    } else { ficha.innerHTML = ''; return; }
    const vehIds = (cliente.vehiculos || []).map(v => v.id);
    const gs = await sbListarGestionesDeCliente(cliente.id, vehIds);
    conAliases(gs);
    gs.forEach(reemplazarEnCache);   // el detalle y el panel las encuentran
    renderFicha360(cliente, gs);
  } catch (err) {
    console.error('[CETA] abrirFicha360', err);
    ficha.innerHTML = `<div class="al wr"><i class="fas fa-triangle-exclamation"></i><div>No se pudo cargar la ficha — reintenta.</div></div>`;
  }
}

function renderFicha360(cliente, gs){
  const ficha = $('#cliFicha'); if (!ficha) return;
  const hoyISO = new Date().toISOString().slice(0, 10);
  const citas = gs.filter(g => g.resultado === 'agenda' && g.fechaCita && g.fechaCita >= hoyISO)
                  .sort((a, b) => a.fechaCita.localeCompare(b.fechaCita));
  const segs  = gs.filter(g => g.resultado === 'seg' && g.segFecha);
  const cots  = gs.filter(g => g.valor || g.kmServicio);
  const veh = v => `<span class="badge" style="font-size:11px"><i class="fas fa-car" style="font-size:9px"></i> <span class="mono">${esc(v.placa)}</span> · ${esc([v.marca, v.modelo].filter(Boolean).join(' ') || '—')}${v.km_actual != null ? ` · ${Number(v.km_actual).toLocaleString('es-CO')} km` : ''}${v.combustion ? ' · ' + esc(v.combustion) : ''}</span>`;

  ficha.innerHTML = `
    <div class="fb">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#b71c1c);color:#fff;display:grid;place-items:center;font-weight:800;font-family:var(--fd);font-size:16px">${esc((cliente.nombre || '?').trim().charAt(0).toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fd);font-weight:800;font-size:16px">${esc(cliente.nombre || '—')}</div>
          <div style="font-size:11px;color:var(--tx2)">${cliente.telefono ? `<i class="fas fa-phone" style="font-size:9px"></i> ${esc(cliente.telefono)}` : ''}${cliente.ciudad ? ` · <i class="fas fa-location-dot" style="font-size:9px"></i> ${esc(cliente.ciudad)}` : ''}${cliente.fecha_nacimiento ? ` · <i class="fas fa-cake-candles" style="font-size:9px"></i> ${esc(cliente.fecha_nacimiento)}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(cliente.vehiculos || []).map(veh).join('') || '<span style="font-size:11px;color:var(--tx3)">Sin vehículos registrados</span>'}</div>
    </div>

    ${segs.length ? `<div class="al in" style="margin-bottom:10px"><i class="fas fa-clock"></i><div><strong>Seguimiento activo:</strong> ${esc(segs[0].segFecha)}${segs[0].segHora && segs[0].segHora !== '00:00' ? ' · ' + esc(segs[0].segHora) : ''} — ${esc(segs[0].segObs || 'sin nota')} <span style="color:var(--tx3)">(${esc(segs[0].asesorCeta || '—')})</span></div></div>` : ''}
    ${citas.length ? `<div class="al" style="background:var(--oks);border-left:3px solid var(--ok);margin-bottom:10px"><i class="fas fa-calendar-check" style="color:var(--ok)"></i><div><strong>Próxima cita:</strong> ${esc(citas[0].fechaCita)}${citas[0].horaCita ? ' · ' + esc(citas[0].horaCita) : ''}${citas[0].asesorTaller ? ' — ' + esc(citas[0].asesorTaller) : ''} <span class="mono" style="color:var(--tx3)">${esc(citas[0].placa || '')}</span></div></div>` : ''}

    <div class="sub-l" style="margin-top:14px"><i class="fas fa-clock-rotate-left"></i>Línea de tiempo (${gs.length} gestiones)</div>
    ${gs.length ? gs.map(g => {
      const gestionable = canEditCase(g) && (g.resultado === 'pendiente' || g.resultado === 'seg' || g.resultado === 'noc');
      return `<div class="fb cli-g" data-id="${esc(g.id)}" style="cursor:pointer;display:flex;align-items:center;gap:12px;border-left:3px solid ${RESULT_COLOR[g.resultado] || 'var(--bd2)'}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px">
            <strong>${esc(RESULT_LABEL[g.resultado] || g.resultado || '—')}</strong>
            <span class="mono" style="font-size:10px;color:var(--tx3)">${esc(g.placa || '')}</span>
            <span style="color:var(--tx3);font-size:11px">${esc(fmtFechaHora(g._ts))}</span>
            <span class="badge">${esc(g.asesorCeta || g.asignadoAlias || '—')}</span>
            ${g.origen ? `<span style="font-size:10px;color:var(--tx3)">${esc(g.origen)}</span>` : ''}
          </div>
          ${(g.observacion || g.segObs) ? `<div style="font-size:11px;color:var(--tx2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.observacion || g.segObs)}</div>` : ''}
        </div>
        ${gestionable ? `<button class="btn btn-gh cli-gestionar" data-id="${esc(g.id)}" style="flex-shrink:0;font-size:11px"><i class="fas fa-headset"></i> Gestionar</button>` : ''}
        <i class="fas fa-chevron-right" style="color:var(--tx3);font-size:10px;flex-shrink:0"></i>
      </div>`;
    }).join('') : emptyState('fa-inbox', 'Sin gestiones registradas', 'Este cliente aún no tiene historia con el equipo CETA.')}

    ${cots.length ? `<div class="sub-l" style="margin-top:14px"><i class="fas fa-calculator"></i>Cotizaciones (${cots.length})</div>
      ${cots.map(g => `<div class="fb" style="display:flex;gap:12px;align-items:center;font-size:12px"><i class="fas fa-file-invoice-dollar" style="color:var(--gd)"></i><div style="flex:1">${esc(g.servicio || g.motivo || '—')} · <span class="mono">${esc(g.kmServicio || '—')}</span> <span class="mono" style="font-size:10px;color:var(--tx3)">${esc(g.placa || '')}</span></div><strong>${g.valor ? '$ ' + Number(g.valor).toLocaleString('es-CO') : '—'}</strong></div>`).join('')}` : ''}`;

  $$('#cliFicha .cli-gestionar').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); gestionarCaso(b.dataset.id); }));
  $$('#cliFicha .cli-g').forEach(c => c.addEventListener('click', () => openCaseDetail(c.dataset.id)));
}

// Hook del buscador global: si el término parece placa o teléfono, sugiere
// clientes reales (con debounce) junto a los resultados de contenido.
let _omniCliTimer = null;
function omniClientes(q){
  clearTimeout(_omniCliTimer);
  const t = q.trim();
  if (t.length < 3 || !supabaseEnabled || !S.user) return;
  if (!/\d/.test(t) && !/^[a-zA-Z]{3,6}$/.test(t)) return;   // placa parcial o algo con dígitos
  _omniCliTimer = setTimeout(async () => {
    try {
      const sugs = await sbSugerirClientes(t);
      if (!sugs.length) return;
      // el término cambió mientras buscaba (comparación en minúsculas: q llega
      // lowercased desde omniSearch y el input conserva las mayúsculas de la placa)
      if (($('#omniInput')?.value || '').trim().toLowerCase() !== t.toLowerCase()) return;
      const res = $('#omniRes');
      res.insertAdjacentHTML('afterbegin', sugs.map((s, i) => `
        <div class="omni-item omni-cli" data-i="${i}"><i class="fas fa-id-card" style="font-size:10px;color:var(--ac)"></i>${esc(s.nombre)} · <span class="mono" style="font-size:10px">${esc(s.placa || '')}</span>${s.telefono ? ' · ' + esc(s.telefono) : ''}<span class="k">Cliente</span></div>`).join(''));
      res.classList.add('show');
      $$('#omniRes .omni-cli').forEach(el => el.addEventListener('click', () => {
        res.classList.remove('show'); $('#omniInput').value = '';
        abrirFicha360(sugs[+el.dataset.i]);
      }));
    } catch {}
  }, 350);
}

// Mini-modal de reasignación rápida (botón en la fila de Control).
function openReasignar(id){
  const g = getGestionesLocal().find(x => x.id === id); if (!g) return;
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-people-arrows"></i> Reasignar caso</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      <div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Caso <strong>${esc(g.placa||'—')}</strong> · ${esc(g.nombre||'')}<br>Actualmente: <strong>${esc(g.asignadoAlias||g.asesorCeta||'—')}</strong></div>
      <div class="ff"><label>Reasignar a</label><select id="reSel">
        <option value="">— Selecciona asesor —</option>
        ${poolAsignacion().map(u=>`<option value="${u.id}" ${u.id===g.asignadoId?'disabled':''}>${esc(u.alias)} (${esc(u.nombre)})${u.id===g.asignadoId?' · actual':''}</option>`).join('')}
      </select></div>
    </div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="reGo"><i class="fas fa-check"></i> Reasignar</button></div>`);
  $('#reGo').addEventListener('click', async () => {
    const nid = $('#reSel').value || '';
    if (!nid) { toast('Elige un asesor'); return; }
    try {
      const r = await reasignarCaso(id, nid);
      if (r) { modalClose(); renderControl(); renderInternos(); updateInternosBadges(); toast(`✅ Reasignado a ${r.asignadoAlias}`); }
    } catch (err) { console.error(err); toast('⚠️ No se pudo reasignar — reintenta'); }
  });
}

// ===== MODAL: configurar columnas (solo coordinador) =====
function openColsConfig(){
  if (!can('config')) return;
  const active = new Set(getCtrlCols());
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-table-columns"></i> Columnas de la tabla</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Elige qué columnas se muestran. Se guarda en este navegador.</div>
      ${CTRL_COLUMNS.map(c => `<label class="tog" style="padding:7px 0;border-bottom:1px solid var(--bd);justify-content:space-between;width:100%">
        <span>${esc(c.label)}</span>
        <span class="tog-sw col-tg ${active.has(c.key)?'on':''}" data-col="${c.key}"></span>
      </label>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-gh" id="colsReset"><i class="fas fa-rotate-left"></i> Restaurar vista por defecto</button>
      <button class="btn btn-ac" id="colsSave"><i class="fas fa-check"></i> Aplicar</button>
    </div>`);
  $$('#modal .col-tg').forEach(sw => sw.addEventListener('click', () => sw.classList.toggle('on')));
  $('#colsReset').addEventListener('click', () => { resetCtrlCols(); modalClose(); renderControl(); toast('Vista restaurada'); });
  $('#colsSave').addEventListener('click', () => {
    const keys = CTRL_COLUMNS.filter(c => $(`#modal .col-tg[data-col="${c.key}"]`).classList.contains('on')).map(c => c.key);
    if (!keys.length) { toast('Selecciona al menos una columna'); return; }
    setCtrlCols(keys); modalClose(); renderControl(); toast('Columnas actualizadas');
  });
}

// ===== MODAL: detalle / edición de caso =====
// El modal de detalle es SOLO LECTURA: el único medio de gestión/tipificación
// es el Panel de Cierre (botón "Gestionar en el panel →", disponible para
// casos pendientes y en seguimiento). Aquí solo se consulta y se reasigna.
function openCaseDetail(id){
  const g = getGestionesLocal().find(x => x.id === id);
  if (!g) { toast('Caso no encontrado'); return; }
  const editable = canEditCase(g);
  // Gestionable en el panel: casos internos pendientes y CUALQUIER gestión
  // en seguimiento o no contesta (el reintento/callback se re-tipifica desde
  // el panel, sin importar el origen).
  const gestionable = editable && (g.resultado === 'pendiente' || g.resultado === 'seg' || g.resultado === 'noc');
  const hist = (g.historial||[]).slice().sort((a,b)=>a.ts-b.ts);

  modalOpen(`
    <div class="modal-head">
      <h3><i class="fas fa-folder-open"></i> Caso ${esc(g.placa||'—')} · ${esc(g.nombre||'Sin nombre')}</h3>
      <button class="ib" data-modal-close><i class="fas fa-xmark"></i></button>
    </div>
    <div class="modal-body">
      <div class="badges" style="margin-bottom:12px">
        ${g.origen==='Interno'?`<span class="badge" style="background:rgba(168,85,247,.12);color:#a855f7"><i class="fas fa-inbox"></i> Interno · Cola ${esc(g.cola||'—')}</span>`:''}
        <span class="badge"><i class="fas fa-user"></i> ${g.origen==='Interno'?'Asignado':'Creó'}: ${esc(g.asignadoAlias||g.createdByAlias||g.asesorCeta||'—')}</span>
        <span class="badge"><i class="fas fa-clock"></i> ${esc(fmtFechaHora(g._ts))}</span>
        ${!editable?'<span class="badge" style="background:var(--wrs);color:var(--wr)"><i class="fas fa-eye"></i> Solo lectura</span>':''}
      </div>

      ${g.notaSolicitante?`<div class="al in" style="margin-bottom:12px"><i class="fas fa-quote-left"></i><div><strong>Nota del solicitante:</strong> ${esc(g.notaSolicitante)}${g.grupoChat?`<div style="font-size:10px;color:var(--tx3);margin-top:3px">Origen: ${esc(g.grupoChat)} · Radicó: ${esc(g.radicadoPor||'—')}</div>`:''}</div></div>`:''}

      ${gestionable?`<button class="btn btn-ac btn-big" id="mdGestionar" style="margin-bottom:12px"><i class="fas fa-headset"></i> Gestionar en el panel →</button>
      <div style="font-size:10px;color:var(--tx3);margin:-6px 0 12px;text-align:center">La tipificación y la cita se registran únicamente desde el Panel de Cierre.</div>`:''}

      ${can('reasignar')?`<div class="sub-l"><i class="fas fa-people-arrows"></i>Reasignar caso</div>
      <div class="rr"><div class="ff"><select id="mdReasignar">
        <option value="">— Mantener: ${esc(g.asignadoAlias||g.asesorCeta||'—')} —</option>
        ${poolAsignacion().map(u=>`<option value="${u.id}" ${u.id===g.asignadoId?'disabled':''}>${esc(u.alias)} (${esc(u.nombre)})${u.id===g.asignadoId?' · actual':''}</option>`).join('')}
      </select></div><div class="ff" style="flex:0 0 auto"><button class="btn btn-gh" id="mdReasignarBtn" style="margin-top:14px"><i class="fas fa-people-arrows"></i> Reasignar</button></div></div>`:''}

      <div class="sub-l"><i class="fas fa-circle-info"></i>Datos del caso</div>
      <div class="rr"><div class="ff"><label>Nombre</label><input value="${esc(g.nombre||'')}" disabled></div><div class="ff"><label>Placa</label><input class="mono" value="${esc(g.placa||'')}" disabled></div></div>
      <div class="rr"><div class="ff"><label>Teléfono</label><input value="${esc(g.telefono||'')}" disabled></div><div class="ff"><label>Km actual</label><input value="${esc(g.kmActual||'')}" disabled></div></div>
      <div class="rr"><div class="ff"><label>Ciudad</label><input value="${esc(g.ciudad||'')}" disabled></div><div class="ff"><label>Servicio</label><input value="${esc(g.servicio||'')}" disabled></div></div>

      <div class="sub-l" style="margin-top:10px"><i class="fas fa-flag"></i>Estado / Resultado</div>
      <div class="ff"><input value="${esc(RESULT_LABEL[g.resultado]||g.resultado||'—')}" disabled></div>

      ${(g.fechaCita||g.horaCita||g.asesorTaller)?`<div class="sub-l" style="margin-top:10px"><i class="fas fa-calendar-check"></i>Cita en taller</div>
      <div class="rr"><div class="ff"><label>Fecha cita</label><input value="${esc(g.fechaCita||'—')}" disabled></div><div class="ff"><label>Hora cita</label><input value="${esc(g.horaCita||'—')}" disabled></div></div>
      <div class="rr full"><div class="ff"><label>Asesor servicio (taller)</label><input value="${esc(g.asesorTaller||'—')}" disabled></div></div>`:''}

      <div class="sub-l" style="margin-top:14px"><i class="fas fa-clock-rotate-left"></i>Historial del caso</div>
      <div class="case-hist">
        ${hist.map(h=>`<div class="hist-item">
          <div class="hist-dot" style="background:${RESULT_COLOR[h.resultado]||'var(--tx3)'}"></div>
          <div><div style="font-size:11px"><strong>${esc(h.tipo)}</strong> · ${esc(fmtFechaHora(h.ts))} · ${esc(h.autor||'—')} <span class="tag" style="background:${RESULT_COLOR[h.resultado]||'var(--bgs)'}22;color:${RESULT_COLOR[h.resultado]||'var(--tx2)'};margin-left:4px">${esc(RESULT_LABEL[h.resultado]||h.resultado||'—')}</span></div>${h.nota?`<div style="font-size:11px;color:var(--tx2);margin-top:2px">${esc(h.nota)}</div>`:''}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-gh" data-modal-close>Cerrar</button>
      ${gestionable?`<button class="btn btn-ac" id="mdGestionarFoot"><i class="fas fa-headset"></i> Gestionar en el panel</button>`:''}
    </div>`);

  // Reasignar (solo coordinación) — disponible aunque el caso sea de otro asesor.
  const reBtn = $('#mdReasignarBtn');
  if (reBtn) reBtn.addEventListener('click', () => {
    const nid = $('#mdReasignar').value || '';
    if (!nid) { toast('Elige un asesor'); return; }
    reasignarCaso(id, nid)
      .then(r => { if (r) { modalClose(); renderControl(); renderInternos(); updateInternosBadges(); toast(`✅ Reasignado a ${r.asignadoAlias}`); } })
      .catch(err => { console.error(err); toast('⚠️ No se pudo reasignar — reintenta'); });
  });

  // Único camino de gestión: el Panel de Cierre.
  const irAlPanel = () => { modalClose(); gestionarCaso(id); };
  const gest = $('#mdGestionar');     if (gest) gest.addEventListener('click', irAlPanel);
  const gestF = $('#mdGestionarFoot'); if (gestF) gestF.addEventListener('click', irAlPanel);
}
function fmtHora(ts){ if(!ts) return '—'; const d=new Date(ts); return d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}); }
function fmtFechaHora(ts){ if(!ts) return '—'; const d=new Date(ts); return d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}); }

// ===== GRÁFICAS de Control de Gestión (CSS puro, sin librerías) =====
const CHART_COLORS = ['#e53935','#2563eb','#16a34a','#ea580c','#a855f7','#0891b2','#b45309','#db2777'];
// Barras horizontales a partir de un mapa {etiqueta: valor}.
function barChart(titulo, icon, mapa, color){
  const entries = Object.entries(mapa).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const max = Math.max(1, ...entries.map(([,v])=>v));
  const body = entries.length
    ? entries.map(([k,v])=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px"><div style="width:110px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(k)}</div><div style="flex:1;background:var(--bgs);border-radius:4px;height:16px;overflow:hidden"><div style="width:${Math.round(v/max*100)}%;height:100%;background:${color||'var(--ac)'}"></div></div><div style="width:26px;text-align:right;font-family:var(--fm);font-weight:600">${v}</div></div>`).join('')
    : '<div style="font-size:11px;color:var(--tx3)">Sin datos.</div>';
  return `<div class="fb"><div class="bt val" style="margin-bottom:10px"><span class="n"><i class="fas ${icon}"></i></span>${esc(titulo)}</div>${body}</div>`;
}
// Dona simple con conic-gradient + leyenda, a partir de {etiqueta: valor}.
function donutChart(titulo, icon, mapa){
  const entries = Object.entries(mapa).filter(([,v])=>v>0);
  const total = entries.reduce((s,[,v])=>s+v,0);
  if (!total) return `<div class="fb"><div class="bt val" style="margin-bottom:10px"><span class="n"><i class="fas ${icon}"></i></span>${esc(titulo)}</div><div style="font-size:11px;color:var(--tx3)">Sin datos.</div></div>`;
  let acc = 0; const segs = [];
  entries.forEach(([k,v],i)=>{ const ini=acc/total*360, fin=(acc+v)/total*360; segs.push(`${CHART_COLORS[i%CHART_COLORS.length]} ${ini}deg ${fin}deg`); acc+=v; });
  const leyenda = entries.map(([k,v],i)=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:3px"><span style="width:10px;height:10px;border-radius:2px;background:${CHART_COLORS[i%CHART_COLORS.length]};flex-shrink:0"></span>${esc(k)} <span style="color:var(--tx3);margin-left:auto;font-family:var(--fm)">${v} (${Math.round(v/total*100)}%)</span></div>`).join('');
  return `<div class="fb"><div class="bt val" style="margin-bottom:10px"><span class="n"><i class="fas ${icon}"></i></span>${esc(titulo)}</div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="width:110px;height:110px;border-radius:50%;background:conic-gradient(${segs.join(',')});flex-shrink:0;position:relative"><div style="position:absolute;inset:28px;background:var(--bgp);border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-weight:800;font-size:18px">${total}</div></div>
      <div style="flex:1;min-width:140px">${leyenda}</div>
    </div></div>`;
}
// Barras apiladas: tipo de servicio por asesor. data = {asesor: {servicio:n}}.
function stackedChart(titulo, icon, data, categorias){
  const asesores = Object.keys(data);
  if (!asesores.length) return `<div class="fb"><div class="bt val" style="margin-bottom:10px"><span class="n"><i class="fas ${icon}"></i></span>${esc(titulo)}</div><div style="font-size:11px;color:var(--tx3)">Sin datos.</div></div>`;
  const totByAsesor = a => categorias.reduce((s,c)=>s+(data[a][c]||0),0);
  const maxTot = Math.max(1, ...asesores.map(totByAsesor));
  const leyenda = categorias.map((c,i)=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;margin-right:8px"><span style="width:9px;height:9px;border-radius:2px;background:${CHART_COLORS[i%CHART_COLORS.length]}"></span>${esc(c)}</span>`).join('');
  const filas = asesores.sort((a,b)=>totByAsesor(b)-totByAsesor(a)).map(a=>{
    const segs = categorias.map((c,i)=>{ const v=data[a][c]||0; if(!v) return ''; return `<div title="${esc(c)}: ${v}" style="width:${Math.round(v/maxTot*100)}%;background:${CHART_COLORS[i%CHART_COLORS.length]};height:100%"></div>`; }).join('');
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px"><div style="width:110px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a)}</div><div style="flex:1;display:flex;background:var(--bgs);border-radius:4px;height:16px;overflow:hidden">${segs}</div><div style="width:26px;text-align:right;font-family:var(--fm);font-weight:600">${totByAsesor(a)}</div></div>`;
  }).join('');
  return `<div class="fb"><div class="bt val" style="margin-bottom:8px"><span class="n"><i class="fas ${icon}"></i></span>${esc(titulo)}</div><div style="margin-bottom:8px">${leyenda}</div>${filas}</div>`;
}

// Arma las 4 gráficas a partir de las gestiones filtradas que ve el usuario.
function graficasHTML(rows){
  if (!rows.length) return '';
  // Solo cuentan las AGENDADAS para "agendas por ciudad/asesor"; resultados usa todo.
  const agendadas = rows.filter(g => g.resultado === 'agenda');
  // Agendas por ciudad
  const porCiudad = {};
  agendadas.forEach(g => { const c = g.ciudad||'—'; porCiudad[c]=(porCiudad[c]||0)+1; });
  // Casos por asesor (a quién se agenda)
  const porAsesor = {};
  agendadas.forEach(g => { const a = g.asignadoAlias||g.asesorCeta||'—'; porAsesor[a]=(porAsesor[a]||0)+1; });
  // Tipo de servicio por asesor (apilada) — sobre todas las gestiones con servicio
  const servicios = [...new Set(rows.map(g=>g.servicio).filter(Boolean))];
  const tipoPorAsesor = {};
  rows.forEach(g => { if(!g.servicio) return; const a=g.asignadoAlias||g.asesorCeta||'—'; (tipoPorAsesor[a]=tipoPorAsesor[a]||{})[g.servicio]=(tipoPorAsesor[a][g.servicio]||0)+1; });
  // Resultados (estado de gestión)
  const porResultado = {};
  rows.forEach(g => { const r = RESULT_LABEL[g.resultado]||g.resultado||'—'; porResultado[r]=(porResultado[r]||0)+1; });

  return `
    <div class="sub-l" style="margin-top:18px"><i class="fas fa-chart-column"></i>Gráficas</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${barChart('Agendas por ciudad','fa-location-dot',porCiudad,'#2563eb')}
      ${barChart('Casos agendados por asesor','fa-user-check',porAsesor,'#16a34a')}
      ${stackedChart('Tipo de servicio por asesor','fa-layer-group',tipoPorAsesor,servicios)}
      ${donutChart('Resultados de gestión','fa-circle-half-stroke',porResultado)}
    </div>`;
}

// ===== MODO TV (fullscreen, auto-refresh 60s) =====
let tvTimer = null;
// =============================================================
//  MODO TV DINÁMICO (spec 2026-08-06-modo-tv-dinamico)
//  Ventana espejo: hereda los filtros del Control, consulta Supabase cada
//  30 s y pinta solo los paneles elegidos (selección recordada).
// =============================================================
const LS_TV_PANELES = 'ceta_tv_paneles';
const TV_PANELES = {
  ciudad:     'Agendas por ciudad',
  asesor:     'Gestión por asesor',
  servicio:   'Servicio agendado por asesor',
  pendientes: 'Pendientes y No contesta'
};
let tvWin = null, tvUltimaOk = 0;

function getTVPaneles(){
  try { const s = JSON.parse(localStorage.getItem(LS_TV_PANELES) || 'null'); if (Array.isArray(s) && s.length) return s; } catch {}
  return Object.keys(TV_PANELES);   // primera vez: los 4
}

function openTVConfig(){
  const sel = new Set(getTVPaneles());
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-sliders"></i> Paneles del Modo TV</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      <div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Elige qué se proyecta en el televisor. La selección queda guardada en este navegador.</div>
      ${Object.entries(TV_PANELES).map(([k, l]) => `<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;cursor:pointer"><input type="checkbox" data-tvp="${k}" ${sel.has(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
    </div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="tvCfgSave"><i class="fas fa-floppy-disk"></i> Guardar</button></div>`);
  $('#tvCfgSave').addEventListener('click', () => {
    const marcados = $$('[data-tvp]').filter(c => c.checked).map(c => c.dataset.tvp);
    localStorage.setItem(LS_TV_PANELES, JSON.stringify(marcados.length ? marcados : Object.keys(TV_PANELES)));
    modalClose(); toast('✅ Paneles del TV guardados');
    if (tvWin && !tvWin.closed) actualizarTV();
  });
}

function openModoTV(){
  const w = window.open('', 'ceta_tv', 'width=1280,height=720');
  if (!w) { toast('⚠️ El navegador bloqueó la ventana — permite las ventanas emergentes para este sitio y vuelve a intentar'); return; }
  tvWin = w;
  w.document.title = 'ARMOTOR CETA · Modo TV';
  if (!window._tvUnload) {
    window._tvUnload = true;
    window.addEventListener('pagehide', () => {
      try {
        if (tvWin && !tvWin.closed) tvWin.document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#16161f;color:#e8e8f0;font-family:sans-serif;font-size:clamp(18px,3vw,32px);text-align:center;padding:20px">⚠️ Fuente cerrada — reabre el Modo TV desde Control de Gestión</div>';
      } catch {}
    });
  }
  if (tvTimer) clearInterval(tvTimer);
  actualizarTV();
  tvTimer = setInterval(actualizarTV, 30000);
}
function closeModoTV(){
  if (tvTimer) { clearInterval(tvTimer); tvTimer = null; }
  if (tvWin && !tvWin.closed) tvWin.close();
  tvWin = null;
}

// Consulta el rango del Control en Supabase y re-pinta la ventana TV.
async function actualizarTV(){
  if (!tvWin || tvWin.closed) { if (tvTimer) { clearInterval(tvTimer); tvTimer = null; } tvWin = null; return; }
  let rows = null;
  if (supabaseEnabled) {
    try {
      rows = await sbListarGestiones({ desde: ctrlFiltro.desde + 'T00:00:00-05:00', hasta: ctrlFiltro.hasta + 'T23:59:59-05:00', limite: CTRL_TOPE });
      conAliases(rows);
      tvUltimaOk = Date.now();
    } catch (e) { console.warn('[CETA] actualizarTV', e); }
  }
  if (!rows) rows = ctrlRango.rows || gestionesVisibles();
  const fil = rows.filter(g =>
    (!ctrlFiltro.asesor || g.asesorCeta === ctrlFiltro.asesor) &&
    (!ctrlFiltro.resultado || g.resultado === ctrlFiltro.resultado));
  try { pintarTV(fil); } catch (e) { console.error('[CETA] pintarTV', e); }
}

// Arma el HTML completo de la ventana TV (autocontenido, responsive).
function tvHTML(rows){
  const paneles = getTVPaneles();
  const total = rows.length;
  const agend = rows.filter(g => g.resultado === 'agenda').length;
  const segc  = rows.filter(g => g.resultado === 'seg').length;
  const nocc  = rows.filter(g => g.resultado === 'noc').length;
  const pend  = rows.filter(g => g.resultado === 'pendiente').length;
  const barra = (n, max, color) => `<div class="bar"><div style="width:${Math.round(n / Math.max(1, max) * 100)}%;background:${color}"></div></div>`;
  const bloques = [];

  if (paneles.includes('ciudad')) {
    const por = {};
    rows.filter(g => g.resultado === 'agenda').forEach(g => { por[g.ciudad || '—'] = (por[g.ciudad || '—'] || 0) + 1; });
    const max = Math.max(1, ...Object.values(por), 1);
    bloques.push(`<div class="card"><h2>📍 Agendas por ciudad</h2>${
      Object.entries(por).sort((a, b) => b[1] - a[1]).map(([c, n]) =>
        `<div class="fila"><span class="lbl">${esc(c)}</span>${barra(n, max, 'var(--ok)')}<span class="num">${n}</span></div>`).join('') || '<div class="vacio">Sin agendas en el rango</div>'
    }</div>`);
  }
  if (paneles.includes('asesor')) {
    const por = {};
    rows.forEach(g => {
      const a = g.asesorCeta || '—';
      por[a] = por[a] || { t: 0, ag: 0, sg: 0, nc: 0 };
      por[a].t++;
      if (g.resultado === 'agenda') por[a].ag++;
      else if (g.resultado === 'seg') por[a].sg++;
      else if (g.resultado === 'noc') por[a].nc++;
    });
    bloques.push(`<div class="card"><h2>🎧 Gestión por asesor</h2><table><thead><tr><th></th><th>Total</th><th class="ok">Agend.</th><th class="in">Seg.</th><th class="wr">No cont.</th></tr></thead><tbody>${
      Object.entries(por).sort((a, b) => b[1].t - a[1].t).map(([a, x]) =>
        `<tr><td class="lbl">${esc(a)}</td><td><strong>${x.t}</strong></td><td class="ok">${x.ag}</td><td class="in">${x.sg}</td><td class="wr">${x.nc}</td></tr>`).join('') || ''
    }</tbody></table></div>`);
  }
  if (paneles.includes('servicio')) {
    // Barras apiladas por asesor: cada segmento es un tipo de servicio con
    // su color; el largo de la barra es proporcional al total del asesor.
    const por = {}, totTipo = {};
    rows.filter(g => g.resultado === 'agenda').forEach(g => {
      const a = g.asesorCeta || '—', s = g.servicio || g.motivo || 'Sin tipo';
      por[a] = por[a] || { t: 0, ss: {} };
      por[a].t++;
      por[a].ss[s] = (por[a].ss[s] || 0) + 1;
      totTipo[s] = (totTipo[s] || 0) + 1;
    });
    const COLORES = { 'Mantenimiento':'#ef4444', 'Inspección':'#3b82f6', 'Garantía':'#22c55e', 'Especializada':'#f97316', 'Servicio rápido':'#a855f7', 'Accesorios':'#0d9488', 'Correctivo':'#f59e0b', 'Cotización':'#38bdf8' };
    const EXTRA = ['#ec4899', '#84cc16', '#64748b', '#eab308'];
    let extraI = 0;
    const tipos = Object.keys(totTipo).sort((a, b) => totTipo[b] - totTipo[a]);
    const colorDe = {};
    tipos.forEach(s => { colorDe[s] = COLORES[s] || EXTRA[extraI++ % EXTRA.length]; });
    const maxT = Math.max(1, ...Object.values(por).map(x => x.t));
    bloques.push(`<div class="card"><h2>🔧 Tipo de servicio por asesor</h2>
      <div class="leyenda">${tipos.map(s => `<span><i style="background:${colorDe[s]}"></i>${esc(s)}</span>`).join('')}</div>
      ${Object.entries(por).sort((a, b) => b[1].t - a[1].t).map(([a, x]) => `
        <div class="fila"><span class="lbl">${esc(a)}</span>
          <div class="pista"><div class="stack" style="width:${Math.max(3, Math.round(x.t / maxT * 100))}%">${
            tipos.filter(s => x.ss[s]).map(s => `<div title="${esc(s)}: ${x.ss[s]}" style="flex:${x.ss[s]};background:${colorDe[s]}"></div>`).join('')
          }</div></div>
          <span class="num"><strong>${x.t}</strong></span></div>`).join('') || '<div class="vacio">Sin agendas en el rango</div>'
    }</div>`);
  }
  if (paneles.includes('pendientes')) {
    const lista = rows.filter(g => g.resultado === 'pendiente' || g.resultado === 'noc').slice(0, 8);
    bloques.push(`<div class="card"><h2>⏳ Pendientes y No contesta</h2>
      <div class="minis"><div><span class="num big" style="color:#a855f7">${pend}</span><span>Pendientes</span></div><div><span class="num big wr">${nocc}</span><span>No contesta</span></div></div>
      ${lista.map(g => `<div class="fila"><span class="lbl mono">${esc(g.placa || '—')}</span><span class="srvs">${esc(g.asesorCeta || g.asignadoAlias || '—')} · ${esc(RESULT_LABEL[g.resultado] || '')}</span></div>`).join('')}</div>`);
  }

  const filtros = [ctrlFiltro.desde + ' → ' + ctrlFiltro.hasta,
    ctrlFiltro.asesor ? 'Asesor: ' + ctrlFiltro.asesor : '',
    ctrlFiltro.resultado ? (RESULT_LABEL[ctrlFiltro.resultado] || '') : ''].filter(Boolean).join(' · ');
  const haceMin = tvUltimaOk ? Math.round((Date.now() - tvUltimaOk) / 60000) : null;
  return `<style>
    :root{--bg:#16161f;--bgp:#1e1e2a;--bd:#32323f;--tx:#e8e8f0;--tx3:#8b8b9a;--ac:#E53935;--ok:#22c55e;--in:#38bdf8;--wr:#f59e0b}
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:var(--bg);color:var(--tx);font-family:'Segoe UI',sans-serif;padding:clamp(10px,1.5vw,24px)}
    .head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:clamp(8px,1.2vw,18px)}
    .head h1{font-size:clamp(16px,2.2vw,30px);font-weight:800}.head h1 span{color:var(--ac)}
    .head .reloj{font-family:monospace;font-size:clamp(14px,2vw,26px)}
    .filtros{font-size:clamp(10px,1.1vw,14px);color:var(--tx3);margin-bottom:clamp(8px,1vw,16px)}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:clamp(6px,.8vw,14px);margin-bottom:clamp(10px,1.2vw,20px)}
    .kpi{background:var(--bgp);border:1px solid var(--bd);border-radius:10px;padding:clamp(8px,1.2vw,18px);text-align:center}
    .kpi .n{font-size:clamp(22px,3.5vw,52px);font-weight:800}.kpi .l{font-size:clamp(9px,1vw,13px);color:var(--tx3);text-transform:uppercase}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:clamp(8px,1vw,16px)}
    .card{background:var(--bgp);border:1px solid var(--bd);border-radius:10px;padding:clamp(8px,1.2vw,18px)}
    .card h2{font-size:clamp(12px,1.4vw,18px);margin-bottom:clamp(6px,.8vw,12px)}
    .fila{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:clamp(11px,1.2vw,15px)}
    .fila .lbl{flex:0 0 max(90px,9vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fila.srv{align-items:flex-start}.srvs{flex:1;color:var(--tx3);font-size:clamp(10px,1.1vw,14px)}
    .bar{flex:1;background:#2a2a36;border-radius:4px;height:clamp(10px,1.2vw,16px);overflow:hidden}.bar div{height:100%}
    .leyenda{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:clamp(9px,1vw,12px);color:var(--tx3);margin-bottom:8px}
    .leyenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
    .pista{flex:1;background:#2a2a36;border-radius:4px;overflow:hidden}
    .stack{display:flex;height:clamp(12px,1.4vw,18px);border-radius:4px;overflow:hidden}
    .num{font-family:monospace;min-width:26px;text-align:right}.num.big{font-size:clamp(20px,3vw,42px);font-weight:800;display:block}
    .minis{display:flex;gap:24px;margin-bottom:10px}.minis span{display:block;font-size:clamp(9px,1vw,13px);color:var(--tx3)}
    table{width:100%;border-collapse:collapse;font-size:clamp(11px,1.2vw,15px)}
    th{font-size:clamp(9px,1vw,12px);color:var(--tx3);text-transform:uppercase;text-align:right;padding:3px 6px}
    td{padding:3px 6px;text-align:right;border-top:1px solid var(--bd)}td.lbl{text-align:left}
    .ok{color:var(--ok)}.in{color:var(--in)}.wr{color:var(--wr)}.mono{font-family:monospace}
    .vacio{color:var(--tx3);font-size:clamp(11px,1.2vw,14px)}
    .pie{margin-top:clamp(8px,1vw,14px);font-size:clamp(9px,1vw,12px);color:var(--tx3)}
  </style>
  <div class="head"><h1><span>ARMOTOR</span> CETA · Control de Gestión</h1><div class="reloj">${new Date().toLocaleTimeString('es-CO')}</div></div>
  <div class="filtros">📅 ${esc(filtros)} · actualiza cada 30 s</div>
  <div class="kpis">
    <div class="kpi"><div class="n">${total}</div><div class="l">Total</div></div>
    <div class="kpi"><div class="n" style="color:var(--ok)">${agend}</div><div class="l">Agendados</div></div>
    <div class="kpi"><div class="n" style="color:var(--in)">${segc}</div><div class="l">Seguimiento</div></div>
    <div class="kpi"><div class="n" style="color:var(--wr)">${nocc}</div><div class="l">No contesta</div></div>
  </div>
  <div class="grid">${bloques.join('') || '<div class="card"><div class="vacio">Elige los paneles con el botón "Paneles TV" en Control de Gestión.</div></div>'}</div>
  <div class="pie">${haceMin != null && haceMin >= 2 ? `⚠️ Última actualización hace ${haceMin} min (sin conexión — reintentando)` : 'En línea con la base de datos'}</div>`;
}

function pintarTV(rows){
  if (!tvWin || tvWin.closed) return;
  tvWin.document.body.innerHTML = tvHTML(rows);
}

// =============================================================
//  CONFIG (solo coordinador) — los usuarios se gestionan en Supabase
// =============================================================
const inpStyle = 'border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:5px 7px;border-radius:5px;font-size:11px;font-family:var(--f)';

function renderConfig(){
  if (!can('config')) return;
  renderListasConfig();
  renderConexionConfig();
  const bb = $('#btnBorrarCasos'); if (bb) bb.addEventListener('click', () => {
    confirmModal('Limpiar caché local', `Esto borra la <strong>caché de gestiones de este navegador</strong>. Los datos reales viven en Supabase y se recargan al sincronizar. ¿Continuar?`, () => {
      localStorage.removeItem(LS_GESTIONES);
      try { localStorage.removeItem('ceta_colas'); } catch {}
      toast('Caché local limpiada');
      refrescarGestiones({ silencioso:true });
      renderControl(); if ($('#v-internos')?.dataset.built==='1') renderBandeja(); updateInternosBadges(); renderHome();
    });
  });
}

const CIUDADES_PANEL = ['Pereira','Manizales','Armenia','Cartago','La Dorada'];

// Gestión de listas del panel: motivos y servicios (coordinador).
function renderListasConfig(){
  const box = $('#listasTable'); if (!box) return;
  const L = getListas();
  const bloque = (titulo, key, items) => `
    <div style="margin-bottom:12px">
      <div style="font-weight:600;font-size:12px;margin-bottom:4px">${esc(titulo)}</div>
      ${items.length ? items.map((n,idx)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <input class="lst-name" data-key="${key}" data-idx="${idx}" value="${esc(n)}" style="${inpStyle};flex:1">
        <button class="btn btn-gh lst-del" data-key="${key}" data-idx="${idx}" title="Quitar"><i class="fas fa-trash" style="color:var(--ac)"></i></button>
      </div>`).join('') : `<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">Lista vacía.</div>`}
      <button class="btn btn-gh lst-add" data-key="${key}" style="margin-top:2px"><i class="fas fa-plus"></i> Agregar</button>
    </div>`;
  box.innerHTML = `
    <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Estas listas alimentan los selects «Motivo del contacto» y «Servicio» del panel de cierre.</div>
    <div class="rr"><div>${bloque('Motivos del contacto','motivos',L.motivos)}</div><div>${bloque('Tipos de servicio','servicios',L.servicios)}</div></div>
    <button class="btn btn-ac" id="lstSave" style="margin-top:6px"><i class="fas fa-floppy-disk"></i> Guardar listas</button>`;

  const leerDom = (obj) => {
    ['motivos','servicios'].forEach(k => { obj[k] = (obj[k]||[]).map((_,i)=>{ const el=$(`#listasTable .lst-name[data-key="${k}"][data-idx="${i}"]`); return el?el.value:obj[k][i]; }); });
  };
  $$('#listasTable .lst-add').forEach(b => b.addEventListener('click', () => {
    const L2 = getListas(); leerDom(L2); (L2[b.dataset.key] = L2[b.dataset.key]||[]).push(''); saveListas(L2); renderListasConfig();
  }));
  $$('#listasTable .lst-del').forEach(b => b.addEventListener('click', () => {
    const L2 = getListas(); leerDom(L2); L2[b.dataset.key].splice(+b.dataset.idx,1); saveListas(L2); renderListasConfig();
  }));
  $('#lstSave').addEventListener('click', () => {
    const L2 = getListas(); leerDom(L2);
    ['motivos','servicios'].forEach(k => { L2[k] = (L2[k]||[]).map(s=>s.trim()).filter(Boolean); });
    saveListas(L2); renderListasConfig(); poblarListasPanel(); toast('Listas actualizadas ✓');
  });
}

// Campo para pegar la URL del despliegue Apps Script + botón "Probar conexión".
function renderConexionConfig(){
  const box = $('#conexionBox'); if (!box) return;
  const url = getApiUrl();
  const conectado = !!url;
  box.innerHTML = `
    <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Pega aquí la URL que termina en <strong>/exec</strong> del despliegue de Google Apps Script. Mientras no haya URL, la consola opera 100% local.</div>
    <div class="ff" style="margin-bottom:8px"><label>URL del Web App (/exec)</label><input id="apiUrlInput" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(url)}" style="${inpStyle};font-family:var(--fm);font-size:10px"></div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-ac" id="apiSave"><i class="fas fa-floppy-disk"></i> Guardar</button>
      <button class="btn btn-gh" id="apiTest"><i class="fas fa-plug"></i> Probar conexión</button>
      <button class="btn btn-gh" id="apiClear"><i class="fas fa-xmark"></i> Quitar</button>
      <span id="apiEstado" style="font-size:11px;margin-left:4px;color:${conectado?'var(--tx2)':'var(--tx3)'}">${conectado?'<i class="fas fa-circle" style="font-size:7px;color:var(--ok)"></i> URL configurada':'<i class="fas fa-circle" style="font-size:7px;color:var(--tx3)"></i> Sin conexión (modo local)'}</span>
    </div>`;
  $('#apiSave').addEventListener('click', () => { setApiUrl($('#apiUrlInput').value); renderConexionConfig(); toast('URL guardada'); actualizarModoFooter(); });
  $('#apiClear').addEventListener('click', () => { setApiUrl(''); renderConexionConfig(); toast('Conexión removida — modo local'); actualizarModoFooter(); });
  $('#apiTest').addEventListener('click', async () => {
    const u = $('#apiUrlInput').value.trim();
    if (!u) { toast('Pega primero la URL'); return; }
    setApiUrl(u);
    const est = $('#apiEstado'); est.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando…';
    try {
      const r = await apiCall('ping');
      if (r && r.success) { est.innerHTML = `<i class="fas fa-circle-check" style="color:var(--ok)"></i> Conexión OK · ${esc(r.app||'CETA')}`; toast('✅ Conexión exitosa'); actualizarModoFooter(); }
      else { est.innerHTML = '<i class="fas fa-triangle-exclamation" style="color:var(--wr)"></i> Respondió pero sin OK'; }
    } catch (e) {
      est.innerHTML = '<i class="fas fa-circle-xmark" style="color:var(--ac)"></i> No respondió (revisa la URL y que el acceso sea "Cualquiera")';
    }
  });
}
function actualizarModoFooter(){
  const el = $('#ftMode'); if (el) el.textContent = getApiUrl() ? 'En línea' : 'Local';
}

// Modal de confirmación genérico (sí/no).
function confirmModal(titulo, htmlMsg, onYes){
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-triangle-exclamation" style="color:var(--ac)"></i> ${esc(titulo)}</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body"><div style="font-size:13px;line-height:1.6">${htmlMsg}</div></div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="cmYes"><i class="fas fa-check"></i> Confirmar</button></div>`);
  $('#cmYes').addEventListener('click', () => { modalClose(); onYes(); });
}

// =============================================================
//  PLACEHOLDERS (vistas Fase 3)
// =============================================================
function emptyState(icon, title, msg){
  return `<div class="empty"><i class="fas ${icon}"></i><h2>${title}</h2><div>${msg}</div></div>`;
}
function renderContent(){
  renderInbound();
  renderOutbound();
  renderWhatsapp();
  renderLeads();
  renderContactos();
  renderConocimiento('v-productos', ['productos','critico'], 'Productos y Servicios', 'fa-book');
  renderConocimiento('v-manuales', ['operativo'], 'Manuales y Operativo', 'fa-wrench');
  renderCampanias();
  renderVip();
  renderInternos();
  renderControl();
  updateInternosBadges();
}

// =============================================================
//  TEMA
// =============================================================
function togTheme(){
  const h = document.documentElement;
  const c = h.getAttribute('data-theme')==='light' ? 'dark' : 'light';
  h.setAttribute('data-theme', c);
  $('#thIco').className = c==='dark' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('ct', c);
}
(() => { const s = localStorage.getItem('ct'); if (s){ document.documentElement.setAttribute('data-theme', s); } })();

// =============================================================
//  NAVEGACIÓN
// =============================================================
function goTo(v){
  $$('.ni').forEach(n => n.classList.remove('active'));
  const nav = $(`.ni[data-v="${v}"]`); if (nav) nav.classList.add('active');
  $$('.view').forEach(vw => vw.classList.remove('active'));
  const target = $('#v-'+v); if (target) target.classList.add('active');
  // Stale-while-revalidate: cada vista pinta al instante con la caché local y
  // dispara en fondo la lectura fresca desde Supabase (con throttle de 15 s).
  if (v === 'control') { renderControl(); refrescarGestiones({ silencioso:true, throttle:true }); }
  if (v === 'contenido') renderContenidoEditor();
  if (v === 'internos') { renderInternos(); refrescarInternos({ throttle:true }); }
  if (v === 'seguimientos') { renderSeguimientos(); refrescarSeguimientos({ throttle:true }); }
  if (v === 'clientes') renderClientes();
  if (v === 'alertas' && can('config')) renderAlertas();
  if (v === 'home') { renderHome(); renderHomeAlertas(); updateSeguimientosBadge(); refrescarGestiones({ silencioso:true, throttle:true }); refrescarSeguimientos({ throttle:true }); }
}

// =============================================================
//  PANEL — selección de resultado y toggles
// =============================================================
function pickRes(b){
  if (!b) return;
  $$('#resP .pill').forEach(p => p.classList.remove('on'));
  b.classList.add('on'); S.resultado = b.dataset.r;
  // ocultar todos los sub-formularios de resultado
  ['noc-f','sinKm-f','otroTaller-f','seg-f','comunica-f','actualizar-f','companero-f'].forEach(id => { const e=$('#'+id); if(e) e.classList.add('hidden'); });

  const r = S.resultado;
  const mostrar = id => $('#'+id) && $('#'+id).classList.remove('hidden');
  const ocultar = id => $('#'+id) && $('#'+id).classList.add('hidden');
  const todasSec = ['sCotiz','sNovedad','sWego','sAdic','sObs'];

  if (r === 'agenda') {
    todasSec.forEach(mostrar);
    poblarComunicaSub(); poblarHoras();
  } else {
    todasSec.forEach(ocultar);
    if (r === 'noc')        mostrar('noc-f');
    if (r === 'sinKm')      { mostrar('sinKm-f'); prellenarKmSinKm(); }
    if (r === 'otroTaller') mostrar('otroTaller-f');
    if (r === 'seg')        { mostrar('seg-f'); mostrar('sNovedad'); poblarHoras(); }   // seguimiento: novedad + callback
    if (r === 'comunica')   { mostrar('comunica-f'); poblarComunicaSub(); }
    if (r === 'actualizar') mostrar('actualizar-f');   // solo datos del cliente (sección 1) + motivo
    if (r === 'companero')  { mostrar('companero-f'); mostrar('sObs'); }   // mínimo + observación (obligatoria)
  }

  // Cotizador SOLO con motivo Mantenimiento o Cotización, y solo si el resultado lo permite. Punto 1.
  aplicarVisibilidadCotizador();

  // Caso interno Cola B (no factura): Cotización y We Go nunca aplican.
  if (S.casoActivo) {
    const ca = getGestionesLocal().find(x => x.id === S.casoActivo);
    if (ca && colaDeServicio(ca.servicio) === 'B') {
      ocultar('sCotiz'); ocultar('sWego');
    }
  }
  u();
}

// Muestra el cotizador solo cuando el motivo es Mantenimiento o Cotización Y el resultado lo amerita. Punto 1.
function aplicarVisibilidadCotizador(){
  const sec = $('#sCotiz'); if (!sec) return;
  const motivo = ($('#motivoSel')?.value || '').toLowerCase();
  const motivoOk = motivo === 'mantenimiento' || motivo === 'cotización' || motivo === 'cotizacion';
  // resultados donde tiene sentido cotizar
  const resOk = ['agenda','comunica','seg'].includes(S.resultado);
  // caso interno Cola B nunca cotiza
  let colaB = false;
  if (S.casoActivo) { const ca = getGestionesLocal().find(x=>x.id===S.casoActivo); colaB = ca && colaDeServicio(ca.servicio)==='B'; }
  sec.classList.toggle('hidden', !(motivoOk && resOk && !colaB));
}

// Punto 7: al elegir "Sin km", precargar el km actual en "Km que tiene" si está vacío.
function prellenarKmSinKm(){
  const kmActual = $('[data-f="kmActual"]')?.value || '';
  const campo = $('[data-f="kmNoAplica"]');
  if (campo && !campo.value && kmActual) campo.value = kmActual;
}

// Punto 10: toggle de "cliente acepta contratar Telemetría".
function togTeleAcepta(){
  S.teleAcepta = !S.teleAcepta;
  $('#teleAceptaSw')?.classList.toggle('on', S.teleAcepta);
  u();
}

function togNovedad(){
  S.hasNovedad = !S.hasNovedad;
  const sw = $('#novSw');
  sw.classList.toggle('warn', S.hasNovedad); sw.classList.remove('on');
  $('#novedadF').classList.toggle('hidden', !S.hasNovedad);
  if (S.hasNovedad) {
    $('#wegoOk').classList.add('hidden'); $('#wegoBlocked').classList.remove('hidden');
    S.hasWG = false; $('#wgSw').classList.remove('on'); $('#wgF').classList.add('hidden');
  } else {
    $('#wegoOk').classList.remove('hidden'); $('#wegoBlocked').classList.add('hidden');
  }
  u();
}
function togWego(){
  S.hasWG = !S.hasWG;
  $('#wgSw').classList.toggle('on', S.hasWG);
  $('#wgF').classList.toggle('hidden', !S.hasWG);
  u();
}
function togAd(b){
  const k = b.dataset.ad;
  if (S.adicionales.has(k)) { S.adicionales.delete(k); b.classList.remove('on'); }
  else { S.adicionales.add(k); b.classList.add('on'); }
  $('#accF').classList.toggle('hidden', !S.adicionales.has('accesorios'));
  // Telemetría: mostrar casilla "acepta"; si se apaga, resetear el estado.
  const teleOn = S.adicionales.has('telemetria');
  $('#teleF')?.classList.toggle('hidden', !teleOn);
  if (!teleOn && S.teleAcepta) { S.teleAcepta = false; $('#teleAceptaSw')?.classList.remove('on'); }
  u();
}
function togChk(b){
  const k = b.dataset.chk;
  if (S.checks.has(k)) { S.checks.delete(k); b.classList.remove('on'); }
  else { S.checks.add(k); b.classList.add('on'); }
  u();
}
function switchTab(tab, paneId){
  $$('.out-tab').forEach(t => t.classList.remove('active'));
  $$('.out-pane').forEach(p => p.classList.remove('active'));
  tab.classList.add('active'); $('#'+paneId).classList.add('active');
}

// =============================================================
//  ESTADO ↔ DOM
// =============================================================
function syncState(){
  $$('[data-f]').forEach(el => { S.f[el.dataset.f] = (el.value || '').trim(); });
  if (S.user) S.f.asesorCeta = S.user.alias;
  // El asesor de taller es un select dependiente; si está en "Otro", usar el texto libre.
  if (S.f.asesorTaller === '__otro__') S.f.asesorTaller = (S.f.asesorTallerOtro || '').trim();
}

// =============================================================
//  ASESORES DE SERVICIO POR CIUDAD (select dependiente del panel)
// =============================================================
// ===== LISTAS EDITABLES (motivos / servicios del panel) =====
// =============================================================
//  ALERTAS OPERATIVAS (gestionadas por el coordinador)
// =============================================================
const LS_ALERTAS = 'ceta_alertas';
const ALERTA_COLOR = {
  alta:        { bg:'var(--wrs)', bd:'var(--wr)', tx:'var(--wr)', lbl:'Alta' },
  media:       { bg:'rgba(234,88,12,.08)', bd:'#ea9b3c', tx:'#c2710c', lbl:'Media' },
  informativa: { bg:'var(--ins)', bd:'var(--in)', tx:'var(--in)', lbl:'Informativa' }
};
function hoyISO(){ return new Date().toISOString().slice(0,10); }

function getAlertas(){
  let list = [];
  try { list = JSON.parse(localStorage.getItem(LS_ALERTAS) || '[]'); } catch {}
  if (!Array.isArray(list)) list = [];
  // Auto-desactivar temporales vencidas (fechaFin < hoy).
  let cambiado = false;
  const hoy = hoyISO();
  list.forEach(a => {
    if (a.activa && a.tipo === 'temporal' && a.fechaFin && a.fechaFin < hoy) { a.activa = false; cambiado = true; }
  });
  if (cambiado) localStorage.setItem(LS_ALERTAS, JSON.stringify(list));
  return list;
}
function saveAlertas(list){ localStorage.setItem(LS_ALERTAS, JSON.stringify(list)); }

// Alertas activas que aplican a una ciudad (incluye las marcadas "Todas").
// Considera vigencia temporal (fechaInicio/fechaFin) respecto a hoy.
function alertasDeCiudad(ciudad){
  if (!ciudad) return [];
  const hoy = hoyISO();
  return getAlertas().filter(a => {
    if (!a.activa) return false;
    const aplicaCiudad = (a.ciudades||[]).includes('Todas') || (a.ciudades||[]).includes(ciudad);
    if (!aplicaCiudad) return false;
    if (a.tipo === 'temporal') {
      if (a.fechaInicio && hoy < a.fechaInicio) return false;
      if (a.fechaFin && hoy > a.fechaFin) return false;
    }
    return true;
  });
}
function hayAlertasCiudad(ciudad){ return alertasDeCiudad(ciudad).length > 0; }

// Orden por prioridad para mostrar primero las más graves.
const PRIORIDAD_ORDEN = { alta:0, media:1, informativa:2 };
function ordenarPorPrioridad(arr){ return arr.slice().sort((a,b)=>(PRIORIDAD_ORDEN[a.prioridad]??9)-(PRIORIDAD_ORDEN[b.prioridad]??9)); }

// Render de una tarjeta de alerta (reutilizada en panel/home/vista).
function alertaCard(a, compacta){
  const c = ALERTA_COLOR[a.prioridad] || ALERTA_COLOR.informativa;
  const ciudades = (a.ciudades||[]).join(', ');
  const vig = a.tipo === 'temporal' ? `${esc(a.fechaInicio||'—')} → ${esc(a.fechaFin||'—')}` : 'Permanente';
  return `<div style="background:${c.bg};border-left:3px solid ${c.bd};border-radius:6px;padding:${compacta?'8px 10px':'10px 12px'};margin-bottom:8px">
    <div style="display:flex;align-items:flex-start;gap:8px">
      <i class="fas fa-triangle-exclamation" style="color:${c.tx};margin-top:2px"></i>
      <div style="flex:1">
        <div style="font-weight:700;font-size:${compacta?'12px':'13px'};color:${c.tx}">${esc(a.titulo)}</div>
        <div style="font-size:11px;color:var(--tx2);line-height:1.5;margin-top:2px">${esc(a.descripcion||'')}</div>
        <div style="font-size:9px;color:var(--tx3);margin-top:3px"><i class="fas fa-location-dot"></i> ${esc(ciudades)} · ${esc(vig)}</div>
      </div>
    </div>
  </div>`;
}

const LS_LISTAS = 'ceta_listas';
function getListas(){
  let ov = null;
  try { ov = JSON.parse(localStorage.getItem(LS_LISTAS) || 'null'); } catch {}
  const base = DATA.listas || { motivos: [], servicios: [] };
  return {
    motivos: (ov && Array.isArray(ov.motivos) && ov.motivos.length) ? ov.motivos : base.motivos.slice(),
    servicios: (ov && Array.isArray(ov.servicios) && ov.servicios.length) ? ov.servicios : base.servicios.slice()
  };
}
function saveListas(obj){ localStorage.setItem(LS_LISTAS, JSON.stringify(obj)); }

// ===== CONEXIÓN APPS SCRIPT (URL del despliegue) =====
const LS_API_URL = 'ceta_api_url';
const LS_API_OVERRIDE = 'ceta_api_override';   // '1' si el coordinador la cambió a mano
// La URL efectiva: el código (data.js) MANDA, salvo que el coordinador haya puesto
// una manualmente desde Configuración (override). Así, al publicar una URL nueva,
// todos los dispositivos la toman aunque tuvieran una vieja en localStorage.
function getApiUrl(){
  const fija = (DATA.config.endpoints.base || '').trim();
  const override = localStorage.getItem(LS_API_OVERRIDE) === '1';
  const guardada = (localStorage.getItem(LS_API_URL) || '').trim();
  if (override && guardada) return guardada;   // el coordinador la fijó a mano
  return fija || guardada;                      // por defecto manda la del código
}
// Guarda una URL puesta a mano (marca override para que no la pise el código).
function setApiUrl(url){
  const u = (url||'').trim();
  localStorage.setItem(LS_API_URL, u);
  localStorage.setItem(LS_API_OVERRIDE, u ? '1' : '0');
}
// Llama una acción del Web App. opts.timeout permite ampliar el tiempo de espera
// (Apps Script suele tardar 4-8s, sobre todo en lecturas grandes o el primer hit).
async function apiCall(action, params, method, opts){
  opts = opts || {};
  const base = getApiUrl();
  if (!base) throw new Error('Sin URL configurada');
  const sep = base.includes('?') ? '&' : '?';
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeout || 9000);
  try {
    if (method === 'POST') {
      // action en la query; payload en el body como text/plain → SIN preflight CORS.
      const url = base + sep + 'action=' + encodeURIComponent(action);
      const r = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(params || {}),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: ctrl.signal,
        redirect: 'follow'
      });
      // Intentar leer JSON; si Apps Script redirige y no se puede leer, asumir éxito.
      try { return await r.json(); } catch { return { success: true, _noBody: true }; }
    } else {
      const url = base + sep + 'action=' + encodeURIComponent(action) +
                  (params ? '&' + new URLSearchParams(params).toString() : '');
      const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
      return await r.json();
    }
  } finally { clearTimeout(to); }
}

// Llena los selects de Motivo y Servicio del panel desde las listas (conserva valor).
function poblarListasPanel(){
  const L = getListas();
  const mSel = $('#motivoSel');
  if (mSel) {
    const prev = mSel.value;
    mSel.innerHTML = `<option value="">— Se define en la llamada —</option>` + L.motivos.map(m=>`<option>${esc(m)}</option>`).join('');
    if (L.motivos.includes(prev)) mSel.value = prev;
  }
  const sSel = $('#servicioSel');
  if (sSel) {
    const prev = sSel.value || 'Mantenimiento';
    sSel.innerHTML = L.servicios.map(s=>`<option>${esc(s)}</option>`).join('');
    sSel.value = L.servicios.includes(prev) ? prev : (L.servicios[0] || '');
  }
}

// Genera opciones de hora por franjas (07:00–18:00 cada 20 min). Punto 14.
function opcionesHora(){
  // Franjas de la operación: 7:10 a. m. → 5:50 p. m., cada 20 minutos.
  const out = ['<option value="">—</option>'];
  for (let t = 7 * 60 + 10; t <= 17 * 60 + 50; t += 20) {
    const h = Math.floor(t / 60), m = t % 60;
    const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0');
    const ampm = h < 12 ? 'a.m.' : 'p.m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out.push(`<option value="${hh}:${mm}">${h12}:${mm} ${ampm}</option>`);
  }
  return out.join('');
}
// Puebla todos los selects de hora (.hora-sel) y el de seguimiento, conservando valor.
function poblarHoras(){
  const html = opcionesHora();
  $$('.hora-sel').forEach(sel => { const prev = sel.value; sel.innerHTML = html; if (prev) sel.value = prev; });
  const seg = $('#segHoraSel'); if (seg) { const p = seg.value; seg.innerHTML = html; if (p) seg.value = p; }
}
// Puebla el sub-motivo de "Cliente se comunica". Punto 5.
function poblarComunicaSub(){
  const sel = $('#comunicaSubSel'); if (!sel) return;
  const subs = DATA.tipificador.comunicaSubmotivos || {};
  const prev = sel.value;
  sel.innerHTML = Object.entries(subs).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('');
  if (subs[prev]) sel.value = prev;
}

// Asesores de servicio (taller) para el select de cita, por ciudad.
// Fuente de verdad: tabla asesores_taller en Supabase (caché S.asesoresTaller,
// cargada al login y revalidada al sincronizar). Si la caché está vacía
// (offline / tabla sin poblar), cae al seed de data.js como respaldo.
function getAsesoresServicio(){
  const cache = S.asesoresTaller || [];
  if (cache.length) {
    const mapa = {};
    cache.forEach(a => { if (a.sede) (mapa[a.sede] = mapa[a.sede] || []).push(a.nombre); });
    if (Object.keys(mapa).length) return mapa;
  }
  return JSON.parse(JSON.stringify(DATA.asesoresServicio || {}));
}

// Llena el select de asesor de taller según la ciudad elegida en el panel.
// Conserva el valor previo si sigue siendo válido. selPrevio permite forzar uno.
function poblarAsesorTaller(selPrevio){
  const sel = $('#asesorTallerSel'); if (!sel) return;
  const ciudad = ($('[data-f="ciudad"]')?.value || '').trim();
  const prev = selPrevio != null ? selPrevio : sel.value;
  const lista = (getAsesoresServicio()[ciudad] || []).slice().sort((a,b)=>a.localeCompare(b));
  let html = `<option value="">— Selecciona —</option>`;
  html += lista.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  html += `<option value="__otro__">Otro…</option>`;
  sel.innerHTML = html;
  // restaurar selección previa si aplica
  if (prev && (lista.includes(prev))) sel.value = prev;
  else if (prev === '__otro__') sel.value = '__otro__';
  else sel.value = '';
  toggleAsesorOtro();
}
// Puebla "Quién recoge" del We Go según la ciudad seleccionada (primero = preseleccionado).
function poblarWgQuien(){
  const ciudad = ($('[data-f="ciudad"]')?.value || '').trim();
  const sinCobertura = (DATA.weGoSinCobertura || []).includes(ciudad);
  // Punto 9: ocultar toda la sección We Go en ciudades sin cobertura.
  const sWego = $('#sWego');
  if (sWego) {
    sWego.classList.toggle('hidden', sinCobertura);
    if (sinCobertura && S.hasWG) {   // si estaba activo, desactivarlo
      S.hasWG = false; $('#wgSw')?.classList.remove('on'); $('#wgF')?.classList.add('hidden');
    }
  }
  const sel = $('#wgQuienSel'); if (!sel) return;
  const lista = (DATA.weGoRecoge && DATA.weGoRecoge[ciudad]) || [];   // Alfred solo donde corresponde (punto 8)
  const prev = sel.value;
  sel.innerHTML = lista.length ? lista.map(n => `<option>${esc(n)}</option>`).join('') : '<option value="">— Sin cobertura —</option>';
  if (lista.includes(prev)) sel.value = prev;   // conservar si sigue válido
}
// Iniciales del asesor para identificar quién gestionó (DATA.inicialesAsesor o derivadas del nombre).
function inicialesDe(user){
  if (!user) return '';
  const fijas = DATA.inicialesAsesor && DATA.inicialesAsesor[user.id];
  if (fijas) return fijas;
  const partes = (user.nombre || user.alias || '').trim().split(/\s+/).slice(0,3);
  return partes.map(p => p[0] ? p[0].toUpperCase() : '').join('');
}
function toggleAsesorOtro(){
  const sel = $('#asesorTallerSel');
  const wrap = $('#asesorTallerOtroWrap');
  if (!sel || !wrap) return;
  wrap.classList.toggle('hidden', sel.value !== '__otro__');
}
// Handler del select (onchange en el HTML).
function onAsesorTaller(){ toggleAsesorOtro(); if (sel_val_otro_vacio()) $('#asesorTallerOtro').value=''; u(); }
function sel_val_otro_vacio(){ const s=$('#asesorTallerSel'); return s && s.value !== '__otro__'; }

// =============================================================
//  COTIZADOR KIA (Módulo 3) — seed de precios + detalle por km
// =============================================================
function fmtCOP(n){ return '$ ' + Math.round(n).toLocaleString('es-CO'); }
// Extrae el km real de la etiqueta del servicio. Punto 6.2:
//  - "RV. 10.000 KM"              → 10000 (formato con miles)
//  - "RV. 10,30,50, 110,130,150"  → toma el PRIMER número (10) ×1000 → 10000
//  - "RV. 5,15,25,35..."          → 5 ×1000 → 5000
// Heurística: si el primer número es >= 1000 ya viene en km; si es < 1000, ×1000.
function kmDeDesc(desc){
  const s = String(desc);
  const m = s.match(/(\d[\d.,]*)/);     // primer número (con posibles . o , de miles/listas)
  if (!m) return null;
  // tomar solo los dígitos del PRIMER grupo antes de cualquier coma de lista
  const primero = m[1].split(',')[0].replace(/\./g,'');
  let n = parseInt(primero, 10);
  if (isNaN(n)) return null;
  if (n < 1000) n = n * 1000;           // "10" → 10000 ; "5" → 5000
  return n;
}

// Devuelve la lista de servicios [desc, manoObra, repuestos, kit] de un modelo.
function preciosDeModelo(modelo){ return (DATA.cotizador.precios||{})[modelo] || []; }

// Busca el detalle (incluido/noIncluido) por combustión + km más cercano.
// Punto 6.3: el Stonic está en Gasolina, no busca "Stonic Híbrido" aparte (ya viene clasificado así).
function detallePorKm(combustion, km){
  const porComb = (DATA.cotizador.detalle||{})[combustion];
  if (!porComb || km == null) return null;
  if (porComb[String(km)]) return porComb[String(km)];
  // km más cercano disponible (eléctricos van de 15k en 15k → el más cercano funciona igual)
  const claves = Object.keys(porComb).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
  if (!claves.length) return null;
  let mejor = claves[0];
  claves.forEach(c => { if (Math.abs(c-km) < Math.abs(mejor-km)) mejor = c; });
  return porComb[String(mejor)];
}

// Cálculo principal. Lee Modelo + línea (kmServicio = descripción exacta) del seed.
function computeQuote(){
  const f = S.f;
  if (f.marca && f.marca !== DATA.cotizador.soloMarca) {
    return { found:false, disponible:false, texto:'No disponible', incluye:[], noIncluye:DATA.cotizador.noIncluidoDefault, desglose:'' };
  }
  const lista = preciosDeModelo(f.modelo);
  const item = lista.find(x => x[0] === f.kmServicio);  // kmServicio guarda la descripción exacta
  if (!item) {
    return { found:false, disponible:true, texto:'Consultar', incluye:[], noIncluye:DATA.cotizador.noIncluidoDefault, desglose:'' };
  }
  const manoObra = Number(item[1]) || 0;
  const repuestos = Number(item[2]) || 0;
  const desc = parseInt((f.descuento||'0%'),10) || 0;
  const combo = (DATA.cotizador.combos||[]).find(c => c[0] === f.embellecimiento);
  const valorCombo = combo ? Number(combo[1]) : 0;
  // El descuento aplica SOLO sobre la base descontable de la mano de obra:
  // la columna MO del libro trae una porción fija ($120.000+IVA) que no se
  // descuenta (regla de la base oculta del Excel, validada con casos reales).
  const moFija = Math.min(manoObra, Number(DATA.cotizador.moFijaNoDescontable) || 0);
  const moBase = manoObra - moFija;
  const moDesc = Math.round(moBase * (1 - desc/100)) + moFija;
  // VALOR = MO con descuento (base×(1-d%) + fija) + Repuestos + Embellecimiento
  const precio = moDesc + repuestos + valorCombo;
  // detalle por combustión + km
  const km = kmDeDesc(f.kmServicio);
  const det = detallePorKm(f.combustion, km);
  const incluye = det ? det.incluido : [];
  const noIncluye = det ? det.noIncluido : DATA.cotizador.noIncluidoDefault;
  let desglose = `MO ${fmtCOP(moDesc)}${desc?` (-${desc}%)`:''} + Rep ${fmtCOP(repuestos)}`;
  if (valorCombo) desglose += ` + Emb ${fmtCOP(valorCombo)}`;
  return { found:true, disponible:true, precio, texto:fmtCOP(precio), incluye, noIncluye, desglose,
           manoObra, repuestos, valorCombo, descuento:desc, kit:item[3]||'' };
}

// ===== Cotizador: carga en 3 capas (cache → API en vivo → seed) =====
const LS_COTIZADOR = 'ceta_cotizador_cache';
function cargarCotizadorEnVivo(){
  // Capa 1: si hay precios cacheados de una sesión anterior, úsalos ya.
  try {
    const cache = JSON.parse(localStorage.getItem(LS_COTIZADOR) || 'null');
    if (cache && cache.precios && Object.keys(cache.precios).length) DATA.cotizador.precios = cache.precios;
  } catch {}
  // Pinta de inmediato (con cache o seed) — el asesor nunca espera.
  poblarCotizador();
  // Capa 2: si hay conexión, refresca precios en vivo (timeout 3s).
  if (getApiUrl()) {
    apiCall('consultarCotizador').then(r => {
      if (r && r.precios && Object.keys(r.precios).length) {
        DATA.cotizador.precios = r.precios;
        localStorage.setItem(LS_COTIZADOR, JSON.stringify({ precios: r.precios, ts: Date.now() }));
        poblarCotizador();   // re-pinta con precios frescos
      }
    }).catch(()=>{}); // Capa 3: si falla, se queda con cache/seed (ya pintado)
  }
}

// ===== Cascada de dropdowns del cotizador =====
function poblarCotizador(){
  const cmb = $('#cotCombustion'); if (!cmb) return;
  const tipos = Object.keys(DATA.cotizador.combustion || {});
  if (!cmb.options.length) cmb.innerHTML = tipos.map(t=>`<option>${esc(t)}</option>`).join('');
  // descuentos
  const dsc = $('#cotDescuento');
  if (dsc && !dsc.options.length) dsc.innerHTML = (DATA.cotizador.descuentos||[]).map(d=>`<option>${esc(d)}</option>`).join('');
  // combos
  const emb = $('#cotEmbellecimiento');
  if (emb && !emb.options.length) emb.innerHTML = (DATA.cotizador.combos||[]).map(c=>`<option value="${esc(c[0])}">${esc(cap(c[0].toLowerCase()))}${c[1]?` (+${fmtCOP(c[1])})`:''}</option>`).join('');
  poblarModelos();
}
function poblarModelos(){
  const sel = $('#cotModelo'); if (!sel) return;
  const comb = $('#cotCombustion')?.value || Object.keys(DATA.cotizador.combustion)[0];
  const modelos = (DATA.cotizador.combustion[comb] || []).filter(m => preciosDeModelo(m).length);
  sel.innerHTML = `<option value="">— Selecciona modelo —</option>` + modelos.map(m=>`<option>${esc(m)}</option>`).join('');
  poblarKm();
}
function poblarKm(){
  const sel = $('#cotKm'); if (!sel) return;
  const modelo = $('#cotModelo')?.value || '';
  const lista = preciosDeModelo(modelo);
  sel.innerHTML = lista.length
    ? `<option value="">— Selecciona servicio —</option>` + lista.map(x=>`<option value="${esc(x[0])}">${esc(x[0])}</option>`).join('')
    : `<option value="">— Sin servicios —</option>`;
}
function onCotMarca(){
  const esKia = $('#cotMarca').value === DATA.cotizador.soloMarca;
  $('#cotNoDisponible').classList.toggle('hidden', esKia);
  ['cotCombustion','cotModelo','cotKm','cotDescuento','cotEmbellecimiento'].forEach(id => { const e=$('#'+id); if(e) e.disabled = !esKia; });
  u();
}
function onCotCombustion(){ poblarModelos(); u(); }
function onCotModelo(){ poblarKm(); u(); }

// Render del detalle de servicios (incluido / no incluido) en el panel.
function renderCotDetalle(q){
  const box = $('#cotDetalle'); if (!box) return;
  if (!q || !q.found || !q.incluye || !q.incluye.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <details style="font-size:11px">
      <summary style="cursor:pointer;color:var(--ok);font-weight:600;padding:4px 0">✅ Incluye (${q.incluye.length} servicios)</summary>
      <ul style="list-style:none;margin:4px 0 0;padding:0;columns:1">${q.incluye.map(s=>`<li style="padding:1px 0">• ${esc(s)}</li>`).join('')}</ul>
    </details>
    <div style="font-size:11px;margin-top:4px"><span style="color:var(--wr);font-weight:600">⚠️ No incluido</span> (sujeto a inspección): ${q.noIncluye.map(esc).join(', ')}</div>`;
}

// =============================================================
//  MASTER UPDATE — regenera salidas desde S
// =============================================================
let _ultCiudadPanel = null;
let _ultMotivoPanel = null;
// Advertencia NO bloqueante de doble agendamiento We Go (spec mejoras piloto):
// al completar ciudad+fecha+hora consulta EN VIVO si la franja ya está tomada.
let _wgUltChequeo = '';
function verificarConflictoWeGo(){
  const box = $('#wgConflicto'); if (!box) return;
  const f = S.f;
  const clave = (S.hasWG && f.wgFecha && f.wgHora && f.ciudad) ? `${f.wgFecha}|${f.wgHora}|${f.ciudad}` : '';
  if (clave === _wgUltChequeo) return;
  _wgUltChequeo = clave;
  if (!clave || !supabaseEnabled) { box.innerHTML = ''; return; }
  sbBuscarWeGoEnFranja(f.wgFecha, f.wgHora, f.ciudad, S.casoActivo || null)
    .then(hits => {
      if (_wgUltChequeo !== clave) return;   // la selección cambió mientras consultaba
      box.innerHTML = hits.length
        ? `<div class="al wr" style="margin:4px 0 0;padding:6px 8px;font-size:10px"><i class="fas fa-triangle-exclamation"></i><div>Ya hay ${hits.length === 1 ? 'un We Go' : hits.length + ' We Go'} a esa hora en ${esc(f.ciudad)} (${hits.map(h => esc(h.placa)).join(', ')}). Elige otra franja o continúa solo si es intencional.</div></div>`
        : '';
    })
    .catch(() => {});
}

function u(){
  syncState();
  // Si cambió la ciudad, repoblar asesor de taller + We Go (listas dependientes).
  const ciudadActual = ($('[data-f="ciudad"]')?.value || '').trim();
  if (ciudadActual !== _ultCiudadPanel) { _ultCiudadPanel = ciudadActual; poblarAsesorTaller(''); poblarWgQuien(); renderPanelAlertas(); }
  // Si cambió el motivo, re-evaluar si el cotizador debe mostrarse (punto 1).
  const motivoActual = ($('#motivoSel')?.value || '');
  if (motivoActual !== _ultMotivoPanel) { _ultMotivoPanel = motivoActual; aplicarVisibilidadCotizador(); }
  verificarConflictoWeGo();
  const f = S.f, r = S.resultado;
  const pla = (f.placa||'').toUpperCase(), tel = f.telefono||'';
  let nota='', est='', cau='', mot='', voz='', cli='';

  const q = computeQuote();
  $('#pPrecio').textContent = q.texto;
  const desgEl = $('#pDesglose'); if (desgEl) desgEl.textContent = q.found ? q.desglose : '';
  renderCotDetalle(q);

  const evo = DATA.tipificador.resultadoEvo[r] || {};
  est = evo.estado || ''; cau = evo.causa || '';

  // El "servicio/motivo" para tipificación viene del Motivo del contacto (sección 1).
  const motivo = f.motivo || 'Mantenimiento';
  const kmTxt = f.kmServicio || '';   // ahora es la descripción de la línea (RV. X KM)

  // ===== NOTA QUITER/EVOLUTION — orden pensado para el asesor de taller =====
  // 1º motivo de ingreso + tipo y costo · 2º novedad · 3º validaciones y
  // detalle · al final placa y teléfono · cierre CALL CENTER /iniciales.
  // Sin signos (++, ??, *): máximo detalle legible.
  const valorNota = q.found ? q.texto.replace('$ ', '') : '';
  const motivoSel = f.motivo || (r === 'agenda' || r === 'seg' || r === 'sinKm' ? 'Mantenimiento' : '');
  const motivoLinea = motivoSel
    ? [motivoSel.toUpperCase(), kmTxt.toUpperCase(), valorNota ? `${valorNota} IVA INCLUIDO` : ''].filter(Boolean).join(' ')
    : '';
  const obsGen = f.observacion ? 'OBS: ' + f.observacion.toUpperCase() : '';
  const iniNota = inicialesDe(S.user);
  const armarNota = partes => [motivoLinea, ...partes, pla, tel].filter(Boolean).join(' // ')
    + ' // CALL CENTER' + (iniNota ? ` /${iniNota}` : '');

  if (r === 'agenda') {
    const serv = motivo.toUpperCase();
    mot = serv === 'MANTENIMIENTO' ? 'CAMBIO DE ACEITE' : serv;
    voz = (S.hasNovedad && f.novedad) ? f.novedad.toUpperCase() : 'MANTENIMIENTO PREVENTIVO';
    const pts = [];
    if (S.hasNovedad && f.novedad) pts.push(f.novedad.toUpperCase());          // 2º: la novedad tal cual
    S.checks.forEach(c => pts.push(c));                                        // 3º: VALIDAR …
    if (S.adicionales.has('telemetria')) pts.push(S.teleAcepta ? 'CONTRATA TELEMETRIA' : 'OFRECE TELEMETRIA');
    if (S.adicionales.has('accesorios') && f.accesorios) pts.push('ACCESORIOS: ' + f.accesorios.toUpperCase());
    if (S.hasWG) pts.push('APLICA WE GO' + (f.wgQuien?` (${f.wgQuien.toUpperCase()})`:''));
    if (q.found && q.valorCombo > 0) pts.push(`EMBELLECIMIENTO ${(f.embellecimiento||'').toUpperCase()} $ ${fmtCOP(q.valorCombo).replace('$ ','')}`);
    if (f.srvAdicional) pts.push('SERV. ADICIONAL: ' + f.srvAdicional.toUpperCase());
    if (f.asesorTaller) pts.push('RECIBE: ' + f.asesorTaller.toUpperCase());
    if (f.observacion) pts.push('OBS: ' + f.observacion.toUpperCase());
    if (f.kmActual) pts.push(`${f.kmActual} KM`);
    nota = armarNota(pts);

    const svCli = {Mantenimiento:'el mantenimiento',Revisión:'la revisión',Garantía:'la atención de garantía',Inspección:'la inspección',Especializada:'el diagnóstico'}[motivo] || 'el servicio';
    const lineas = [
      'Le confirmamos lo que realizaremos en su cita:', '',
      `🔧 ${cap(svCli)}${f.modelo?` · ${f.modelo}`:''}${kmTxt?` · ${kmTxt}`:''}`,
      `💰 Valor: ${q.texto} (IVA incluido)`
    ];
    if (q.found && q.valorCombo > 0) lineas.push(`✨ Embellecimiento ${f.embellecimiento}: ${fmtCOP(q.valorCombo)}`);
    if (f.fechaCita || f.horaCita) lineas.push(`📅 Cita: ${[f.fechaCita,f.horaCita].filter(Boolean).join(' · ')}${f.asesorTaller?` con ${f.asesorTaller}`:''}`);
    if (S.hasWG) lineas.push('🚗 Incluimos We Go *sin costo*: recogemos su vehículo y se lo devolvemos.');
    lineas.push('', 'No incluye filtro de aire motor, filtro A/C ni plumillas (sujetos a verificación del técnico).', '', '¡Lo esperamos!');
    cli = lineas.join('\n');

  } else if (r === 'noc') {
    mot = 'SIN RESPUESTA'; voz = (f.tipoNoc||'BUZÓN DE VOZ');
    nota = armarNota([f.tipoNoc||'NO CONTESTA', f.marcaciones||'1 CONTACTO', 'ENVIO PLANTILLA', obsGen]);
    cli = 'Hola 👋 Le saludamos de Armotor. Intentamos comunicarnos sin éxito. Cuando esté disponible, con gusto le atendemos.';
  } else if (r === 'seg') {
    mot = 'CLIENTE OCUPADO'; voz = 'SOLICITA LLAMAR EN OTRO MOMENTO';
    const segPts = ['SE REPROGRAMA CONTACTO'];
    if (f.segFecha || f.segHora) segPts.push('LLAMAR ' + [f.segFecha, f.segHora].filter(Boolean).join(' ').toUpperCase());
    if (S.hasNovedad && f.novedad) { segPts.push('NOVEDAD: ' + f.novedad.toUpperCase()); voz = f.novedad.toUpperCase(); }  // #4
    if (f.segObs) segPts.push('OBS: ' + f.segObs.toUpperCase());   // #3
    nota = armarNota(segPts);
    cli = 'Quedamos en contacto. Cuando lo prefiera retomamos su solicitud. 😊';
  } else if (r === 'comunica') {
    // #5 Cliente se comunica con sub-motivo
    const sub = (DATA.tipificador.comunicaSubmotivos || {})[f.comunicaSub] || {};
    mot = sub.motivo || 'CLIENTE SE COMUNICA'; voz = sub.voz || 'CLIENTE SE COMUNICA';
    const cPts = [mot];
    if (f.comunicaObs) cPts.push('OBS: ' + f.comunicaObs.toUpperCase());
    nota = armarNota(cPts);
    cli = 'Con gusto le ayudamos con su solicitud. Quedamos atentos. 😊';
  } else if (r === 'actualizar') {
    // #2 Actualización de datos (cliente ya no es dueño)
    mot = (f.motivoCambio || 'ACTUALIZACIÓN DE DATOS').toUpperCase(); voz = 'ACTUALIZACIÓN DE DATOS DEL CLIENTE';
    const aPts = ['ACTUALIZACION DE DATOS', mot];
    if (f.actualizarObs) aPts.push('OBS: ' + f.actualizarObs.toUpperCase());
    nota = armarNota(aPts);
    cli = 'Hemos actualizado sus datos. Gracias por informarnos. 😊';
  } else if (r === 'sinKm') {
    mot = 'SERVICIO NO APLICA'; voz = 'AÚN NO CUMPLE KMS';
    nota = armarNota([f.kmNoAplica?`SOLO ${f.kmNoAplica} KMS`:'NO CUMPLE KM', f.reprograma?`SE REPROGRAMA PARA ${f.reprograma.toUpperCase()}`:'SE REPROGRAMA', 'SE ENVIA PLANTILLA', obsGen]);
    cli = 'Le recordaremos cuando su vehículo se acerque al kilometraje de mantenimiento. 🚗';
  } else if (r === 'otroTaller') {
    const rz = f.razonOtro || 'PRECIO';
    mot = rz==='PRECIO'?'PRECIO ALTO':rz==='UBICACION'?'UBICACIÓN':'PREFERENCIA PROVEEDOR';
    voz = rz==='PRECIO'?'OFERTA MÁS ECONÓMICA':rz==='UBICACION'?'MAYOR COMODIDAD':'HISTÓRICO CON OTRO TALLER';
    nota = armarNota([`VISITA OTRO TALLER POR ${rz}`, obsGen]);
    cli = 'Con gusto le compartimos nuestras condiciones cuando lo desee. ¡Que tenga un excelente día!';
  } else if (r === 'noContactar') {
    mot = 'CLIENTE NO INTERESADO'; voz = 'NO DESEA RECIBIR INFORMACIÓN';
    nota = armarNota(['NO VOLVER A CONTACTAR', obsGen]);
    cli = 'Gracias por su atención. Quedamos atentos si en el futuro requiere nuestros servicios.';
  } else if (r === 'companero') {
    mot = 'GESTIONADO POR COMPAÑERO'; voz = 'CONTACTO YA REALIZADO';
    nota = armarNota(['GESTIONADO POR COMPAÑERO', obsGen]);
    cli = '';
  }

  $('#outNota').textContent = nota || '—';
  $('#outCli').textContent  = cli  || '—';
  $('#eEst').textContent = est || '—';
  $('#eCau').textContent = cau || '—';
  $('#eMot').textContent = mot || '—';
  $('#eVoz').textContent = voz || '—';
  validateSemaforo();
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

// =============================================================
//  SEMÁFORO DE COMPLETITUD
// =============================================================
function validateSemaforo(){
  const f = S.f, r = S.resultado;
  const req = [];
  if (!f.nombre) req.push('Nombre');
  if (!f.placa)  req.push('Placa');
  // Km actual SIEMPRE obligatorio — excepto "Sin km" (el cliente no tiene
  // el dato) y "Gestión de compañero" (registro mínimo).
  if (r !== 'sinKm' && r !== 'companero' && !f.kmActual) req.push('Km actual');
  // Gestión de compañero: la observación que referencia la gestión previa es obligatoria.
  if (r === 'companero' && !f.observacion) req.push('Observación (quién gestionó)');
  if (r === 'agenda') {
    if (!f.asesorTaller) req.push('Asesor taller');
    if (S.hasWG) {
      if (!f.wgFecha)     req.push('Fecha We Go');
      if (!f.wgDireccion) req.push('Dirección We Go');
    }
  }
  if (r === 'noContactar' || r === 'otroTaller') {
    // razón ya tiene default; sin requeridos extra
  }
  if (S.hasNovedad && !f.novedad) req.push('Descripción novedad');

  const sem = $('#semaforo'), btn = $('#btnSave');
  const dot = sem.querySelector('.dot'), msg = sem.querySelector('.msg');
  if (req.length === 0) {
    dot.className='dot green'; msg.textContent='Listo para guardar'; sem.classList.add('ok');
    btn.disabled=false; btn.innerHTML='<i class="fas fa-check-circle"></i> GUARDAR GESTIÓN';
  } else if (req.length <= 2) {
    dot.className='dot yellow'; msg.textContent=`Falta: ${req.join(', ')}`; sem.classList.remove('ok');
    btn.disabled=true; btn.innerHTML=`<i class="fas fa-lock"></i> Falta: ${req.join(', ')}`;
  } else {
    dot.className='dot red'; msg.textContent=`${req.length} campos pendientes`; sem.classList.remove('ok');
    btn.disabled=true; btn.innerHTML=`<i class="fas fa-lock"></i> ${req.length} campos pendientes`;
  }
}

// =============================================================
//  COPIAR / TOAST
// =============================================================
function cpText(id, btn){ navigator.clipboard.writeText($('#'+id).textContent); flash(btn); }
function cpEvo(btn){
  const t = ['eEst','eCau','eMot','eVoz'].map(i => $('#'+i).textContent).join(' | ');
  navigator.clipboard.writeText(t); flash(btn);
}
function copyMsg(btn){ cpText('outCli', btn); }
function flash(b){
  b.classList.add('cp'); const o = b.innerHTML;
  b.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
  setTimeout(() => { b.classList.remove('cp'); b.innerHTML = o; }, 1400);
  toast('Copiado');
}
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }

// ===== MODAL genérico =====
function modalOpen(html){
  const ov = $('#modal');
  ov.querySelector('.modal-card').innerHTML = html;
  ov.classList.add('show');
  ov.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', modalClose));
}
function modalClose(){ $('#modal').classList.remove('show'); }

// =============================================================
//  TARJETA (html2canvas)
// =============================================================
function downloadCard(){
  syncState(); const f = S.f, t = $('#tarjeta');
  const q = computeQuote();
  $('#tCli').textContent = f.nombre || 'Cliente';
  $('#tVeh').textContent = `${f.marca||'KIA'} ${f.modelo||'—'} · ${(f.placa||'—').toUpperCase()}`;
  $('#tSrv').textContent = `${f.kmServicio||'Mantenimiento'}`;
  $('#tPr').textContent  = q.texto;
  $('#tFe').textContent  = new Date().toLocaleDateString('es-CO');
  $('#tInc').innerHTML = (q.incluye||[]).map(x => `<li>• ${x}</li>`).join('');
  $('#tExc').innerHTML = (q.noIncluye||[]).map(x => `<li>• ${x}</li>`).join('');
  t.style.left = '0';
  html2canvas(t, {scale:2}).then(c => {
    t.style.left = '-9999px';
    const a = document.createElement('a');
    a.download = `Armotor_${(f.placa||'srv').toUpperCase()}.png`;
    a.href = c.toDataURL(); a.click(); toast('Tarjeta descargada');
  }).catch(() => { t.style.left = '-9999px'; toast('Error al generar la tarjeta'); });
}

// =============================================================
//  GUARDAR GESTIÓN (local; backend pendiente de deploy)
// =============================================================
function buildPayload(){
  syncState(); const f = S.f, q = computeQuote();
  return {
    marcaTemporal: new Date().toISOString(),
    asesorCeta: S.user?.alias || '',
    nombre:f.nombre||'', telefono:f.telefono||'', placa:(f.placa||'').toUpperCase(),
    modelo:f.modelo||'', kmActual:f.kmActual||'', ciudad:f.ciudad||'',
    fechaNac:f.fechaNac||'', origen:f.origen||'', motivo:f.motivo||'',
    servicio:f.servicio||f.motivo||'', kmServicio:f.kmServicio||'', marca:f.marca||'KIA',
    combustion:f.combustion||'', valor: q.found ? Math.round(q.precio) : '',
    alineacion:f.alineacion||'', descuento:f.descuento||'', embellecimiento:f.embellecimiento||'',
    novedad: S.hasNovedad ? 'Sí' : 'No', descNovedad:f.novedad||'',
    weGo: S.hasWG ? 'Sí' : 'No', wgFecha:f.wgFecha||'', wgHora:f.wgHora||'',
    wgDireccion:f.wgDireccion||'', wgQuien:f.wgQuien||'', wgTrayectos:f.wgTrayectos||'',
    telemetria: S.adicionales.has('telemetria') ? (S.teleAcepta ? 'Contrata' : 'Ofrecida') : 'No',
    accesoriosOf: S.adicionales.has('accesorios') ? 'Sí':'No', cualesAccesorios:f.accesorios||'',
    srvAdicional:f.srvAdicional||'',
    resultado:S.resultado, asesorTaller:f.asesorTaller||'', fechaCita:f.fechaCita||'', horaCita:f.horaCita||'',
    observacion:f.observacion||'', comunicaSub:f.comunicaSub||'', motivoCambio:f.motivoCambio||'',
    segFecha:f.segFecha||'', segHora:f.segHora||'', segObs:f.segObs||'', comunicaObs:f.comunicaObs||'', actualizarObs:f.actualizarObs||'',
    notaQuiter: $('#outNota').textContent,
    evoEstado: $('#eEst').textContent, evoCausa: $('#eCau').textContent,
    evoMotivo: $('#eMot').textContent, evoVoz: $('#eVoz').textContent,
    validaciones:[...S.checks]
  };
}

async function saveGestion(){
  if (!can('registrar')) { toast('Tu rol no permite registrar'); return; }
  const payload = buildPayload();
  const btn = $('#btnSave');
  if (btn) { btn.disabled = true; }

  try {
    // Si se está gestionando un caso interno: actualizar el MISMO registro
    // en Supabase (pendiente → resultado final) con TODO el payload del
    // panel (seguimiento, sub-motivos, asesor taller, cotización…).
    if (S.casoActivo) {
      const fila = await sbGestionarCaso(
        S.casoActivo, payload, S.user,
        `Gestionado: ${RESULT_LABEL[payload.resultado]||payload.resultado}`
      );
      conAliases([fila]);
      reemplazarEnCache(fila);
      // La cola de seguimientos reacciona al instante: si dejó de ser
      // seguimiento sale de la cola; si se reprogramó, vuelve con fecha nueva.
      S.seguimientos = (S.seguimientos || []).filter(x => x.id !== S.casoActivo);
      updateSeguimientosBadge();
      refrescarSeguimientos();
      toast('✅ Caso gestionado');
      cancelarCasoActivo();
      limpiarBorrador();
      setTimeout(() => { resetPanel(); renderInternos(); updateInternosBadges(); if ($('#v-seguimientos')?.classList.contains('active')) renderSeguimientos(); }, 600);
      return;
    }

    // Gestión normal (Inbound/Base/etc.): escritura directa en Supabase.
    const fila = await sbGuardarGestion(payload, S.user);
    fila.asesorCeta = S.user?.alias || '';
    fila.createdByAlias = S.user?.alias || '';
    insertarEnCache(fila);
    limpiarBorrador();
    toast('✅ Gestión guardada');
    setTimeout(resetPanel, 600);
    if (payload.resultado === 'seg') refrescarSeguimientos();   // entra a la cola de una vez
    if ($('#v-control')?.classList.contains('active')) renderControl();
    if ($('#v-home')?.classList.contains('active')) renderHome();
  } catch (err) {
    // Online-first: si falla, NO limpiar el formulario. Guardar borrador aparte.
    console.error('[CETA] saveGestion', err);
    try { localStorage.setItem(LS_BORRADOR, JSON.stringify({ ts: Date.now(), payload })); } catch {}
    toast('⚠️ Sin conexión — la gestión no se guardó, reintenta');
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

// ===== Caché local de gestiones (solo lectura instantánea; la fuente de
// verdad es Supabase). Se reescribe tras cada lectura/escritura exitosa. =====
const LS_GESTIONES = 'ceta_gestiones';
const LS_BORRADOR = 'ceta_borrador_gestion';   // borrador de seguridad si falla el guardado

function getGestionesLocal(){
  try { return JSON.parse(localStorage.getItem(LS_GESTIONES) || '[]'); } catch { return []; }
}
function setGestionesLocal(list){
  try { localStorage.setItem(LS_GESTIONES, JSON.stringify((list || []).slice(0, 500))); } catch {}
}
function insertarEnCache(fila){
  const list = getGestionesLocal();
  list.unshift(fila);
  setGestionesLocal(list);
}
function reemplazarEnCache(fila){
  const list = getGestionesLocal();
  const i = list.findIndex(g => g.id === fila.id);
  if (i >= 0) list[i] = fila; else list.unshift(fila);
  setGestionesLocal(list);
}
function limpiarBorrador(){ try { localStorage.removeItem(LS_BORRADOR); } catch {} }

// Rellena los alias de asesor (la BD guarda UUIDs; la UI muestra alias).
function conAliases(list){
  list.forEach(g => {
    if (g.asignadoId && !g.asignadoAlias) { const u = asesorPorId(g.asignadoId); if (u) g.asignadoAlias = u.alias; }
    if (g.createdBy && !g.asesorCeta) {
      const u = asesorPorId(g.createdBy);
      g.asesorCeta = u ? u.alias : (S.user && S.user.id === g.createdBy ? S.user.alias : '');
      if (!g.createdByAlias) g.createdByAlias = g.asesorCeta;
    }
  });
  return list;
}

// REASIGNAR un caso a otro asesor del pool de rotación (solo coordinador).
// Cambia el dueño (asignadoId/createdBy) para que el nuevo asesor pueda editarlo,
// y deja constancia en el historial. No altera la rotación (esta es manual).
async function reasignarCaso(id, nuevoAsesorId){
  if (!can('reasignar')) { toast('No tienes permiso para reasignar'); return null; }
  const nuevo = asesorPorId(nuevoAsesorId);
  if (!nuevo) { toast('Asesor no válido'); return null; }
  const local = getGestionesLocal().find(g => g.id === id);
  if (local && String(local.asignadoId) === String(nuevo.id)) { toast('El caso ya está asignado a ' + nuevo.alias); return null; }
  const fila = await sbAsignarCaso(id, nuevo.id, 'Reasignación manual', S.user?.alias || '', nuevo.alias);
  fila.asignadoAlias = nuevo.alias; fila.asesorCeta = nuevo.alias; fila.createdByAlias = nuevo.alias;
  reemplazarEnCache(fila);
  return fila;
}

// Permiso de edición de un caso: administrador/coordinador editan todo;
// asesor solo el suyo; analista nunca.
function canEditCase(g){
  if (!S.user) return false;
  if (esCoordinacion()) return true;
  // El analista supervisa la cola de seguimientos: puede gestionar y
  // reasignar cualquier seguimiento (spec cola-seguimientos); el resto de
  // casos los ve en solo lectura.
  if (S.user.rol === 'analista') return g.resultado === 'seg';
  return g.createdBy != null && g.createdBy === S.user.id;
}

// =============================================================
//  CASOS INTERNOS — motor de asignación automática
//  Pool de rotación = los 5 asesor_cc (excluye digitales/coordinador/analista).
// =============================================================
const LS_COLAS = 'ceta_colas';

// Los asesores que participan en la rotación (asesor_cc activos), desde la
// caché cargada al iniciar sesión (S.asesoresCC). Ver cargarAsesoresCC().
function rotacionPool(){
  return S.asesoresCC || [];
}
function hoyStr(){ const d = new Date(); return d.toISOString().slice(0,10); }   // YYYY-MM-DD
function colaDeServicio(tipo){
  const t = (DATA.internos.tiposServicio || []).find(x => x.nombre === tipo);
  return t ? t.cola : 'A';   // por defecto Cola A
}

// Baraja determinista-aleatoria (Fisher-Yates) de los ids del pool.
function barajarPool(){
  const ids = rotacionPool().map(u => u.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

// Carga el estado de colas desde localStorage (o lo crea), con RESET DIARIO.
function loadColas(){
  let st;
  try { st = JSON.parse(localStorage.getItem(LS_COLAS) || 'null'); } catch { st = null; }
  if (!st || st.fecha !== hoyStr()) {
    st = { fecha: hoyStr(), A: { orden: barajarPool(), pos: 0 }, B: { orden: barajarPool(), pos: 0 } };
    localStorage.setItem(LS_COLAS, JSON.stringify(st));
  }
  S.colas = st;
  return st;
}
function saveColas(){ if (S.colas) localStorage.setItem(LS_COLAS, JSON.stringify(S.colas)); }

// Toma el siguiente asesor de una cola (REGLA 2: bloques de 5, rebaraja al completar).
function siguienteDeCola(colaKey){
  const st = S.colas || loadColas();
  let c = st[colaKey];
  if (!c.orden || !c.orden.length) { c.orden = barajarPool(); c.pos = 0; }
  if (c.pos >= c.orden.length) { c.orden = barajarPool(); c.pos = 0; } // nuevo bloque
  const asesorId = c.orden[c.pos];
  c.pos += 1;
  saveColas();
  return asesorId;
}

// REGLA 0: ¿la placa tiene caso asignado en los últimos N días? → mismo asesor.
function duenoPorPropiedad(placa){
  if (!placa) return null;
  const pl = placa.toUpperCase().trim();
  const limite = Date.now() - DATA.internos.propiedadDias * 86400000;
  const previo = getGestionesLocal()
    .filter(g => (g.placa||'').toUpperCase().trim() === pl && g.asignadoId != null && (g._ts||0) >= limite)
    .sort((a,b) => (b._ts||0) - (a._ts||0))[0];
  return previo ? previo.asignadoId : null;
}

// Asigna un caso según las reglas. Devuelve { asesorId, alias, motivo, cola }.
function asignarCaso(placa, tipoServicio){
  loadColas();
  const cola = colaDeServicio(tipoServicio);
  // REGLA 0 — propiedad por placa (no consume slot del bloque)
  const dueno = duenoPorPropiedad(placa);
  if (dueno != null) {
    const u = asesorPorId(dueno);
    if (u) return { asesorId: u.id, alias: u.alias, motivo: 'Propiedad (10 días)', cola };
  }
  // REGLA 1/2 — rotación por cola en bloques de 5
  const asesorId = siguienteDeCola(cola);
  const u = asesorPorId(asesorId);
  return { asesorId, alias: u ? u.alias : '—', motivo: `Rotación Cola ${cola}`, cola };
}

// Duplicado: ¿la placa tiene un caso ABIERTO (pendiente o seguimiento)?
function casoAbiertoPorPlaca(placa){
  if (!placa) return null;
  const pl = placa.toUpperCase().trim();
  return getGestionesLocal().find(g =>
    (g.placa||'').toUpperCase().trim() === pl &&
    (g.resultado === 'pendiente' || g.resultado === 'seg')
  ) || null;
}

// Balance del día por asesor y cola (para Control de Gestión).
function balanceDelDia(){
  const hoy = hoyStr();
  const casos = getGestionesLocal().filter(g => g.origen === 'Interno' && new Date(g._ts||0).toISOString().slice(0,10) === hoy);
  const bal = {};
  rotacionPool().forEach(u => { bal[u.alias] = { A: 0, B: 0 }; });
  casos.forEach(g => {
    const alias = g.asignadoAlias;
    if (!bal[alias]) bal[alias] = { A: 0, B: 0 };
    const cola = g.cola || colaDeServicio(g.servicio);
    bal[alias][cola] = (bal[alias][cola] || 0) + 1;
  });
  return bal;
}

// Casos internos PENDIENTES visibles para el usuario actual (su bandeja).
function casosPendientes(){
  const all = getGestionesLocal().filter(g => g.origen === 'Interno' && g.resultado === 'pendiente');
  if (!S.user) return [];
  if (esCoordinacion() || S.user.rol === 'analista') return all;
  return all.filter(g => g.asignadoId === S.user.id);
}

// Precarga el Panel de Cierre con los datos de un caso interno.
// Cola B (Inspección/Especializada/Garantía) → oculta Cotización y We Go.
function precargarPanel(g){
  resetPanel();
  const setF = (k,v) => { const e = $(`[data-f="${k}"]`); if (e && v != null) e.value = v; };
  setF('nombre', g.nombre); setF('telefono', g.telefono); setF('placa', g.placa);
  setF('ciudad', g.ciudad);
  // Datos ya capturados en gestiones anteriores: NO se vuelven a digitar al
  // retomar el caso (el km solo se actualiza si el asesor lo cambia).
  setF('kmActual', g.kmActual); setF('fechaNac', g.fechaNac);
  setF('origen', 'Base');   // origen del contacto en el panel
  // el tipo de servicio del caso interno alimenta el Motivo del contacto (tipificación)
  const mSel = $('#motivoSel');
  if (mSel && g.servicio && [...mSel.options].some(o=>o.value===g.servicio)) mSel.value = g.servicio;
  // poblar asesor de taller según la ciudad del caso y preseleccionar si ya tenía uno
  _ultCiudadPanel = (g.ciudad || '').trim();
  if (g.asesorTaller) {
    const lista = getAsesoresServicio()[(g.ciudad||'').trim()] || [];
    if (lista.includes(g.asesorTaller)) { poblarAsesorTaller(g.asesorTaller); }
    else { poblarAsesorTaller('__otro__'); const o = $('#asesorTallerOtro'); if (o) o.value = g.asesorTaller; }
  } else { poblarAsesorTaller(''); }
  // resultado por defecto al gestionar un pendiente: agenda (el asesor elige)
  pickRes($('#resP .pill[data-r="agenda"]'));
  // Cola B no factura → ocultar Cotización (s3) y We Go (s5)
  const colaB = colaDeServicio(g.servicio) === 'B';
  const sCotiz = $('#sCotiz'), sWego = $('#sWego');
  if (sCotiz) sCotiz.classList.toggle('hidden', colaB);
  if (sWego)  sWego.classList.toggle('hidden', colaB);
  // marca el caso activo y muestra cinta de contexto en el panel
  S.casoActivo = g.id;
  renderCasoActivoBanner(g);
  goTo('inbound');
  u();
}

function renderCasoActivoBanner(g){
  let b = $('#casoActivoBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'casoActivoBanner';
    b.style.cssText = 'margin:0 0 10px;padding:8px 10px;border-radius:6px;background:var(--acs);border-left:3px solid var(--ac);font-size:11px;display:flex;gap:8px;align-items:flex-start';
    const body = $('#rpBody');
    if (body) body.insertBefore(b, body.firstChild);
  }
  b.style.display = 'flex';
  b.innerHTML = `<i class="fas fa-inbox" style="color:var(--ac);margin-top:2px"></i>
    <div style="flex:1"><strong>Gestionando caso interno</strong> · ${esc(g.servicio||'')} (Cola ${esc(g.cola||'—')})
    ${g.notaSolicitante?`<div style="color:var(--tx2);margin-top:3px"><em>"${esc(g.notaSolicitante)}"</em></div>`:''}</div>
    <button class="ib" onclick="cancelarCasoActivo()" title="Cancelar" style="width:22px;height:22px;font-size:11px"><i class="fas fa-xmark"></i></button>`;
}
function cancelarCasoActivo(){
  S.casoActivo = null;
  const b = $('#casoActivoBanner'); if (b) b.style.display = 'none';
  const sCotiz = $('#sCotiz'); if (sCotiz) sCotiz.classList.remove('hidden');
  const sWego = $('#sWego'); if (sWego && S.resultado==='agenda') sWego.classList.remove('hidden');
}

function resetPanel(){
  $$('[data-f]').forEach(i => { if (i.tagName==='SELECT') i.selectedIndex=0; else i.value=''; });
  // repoblar la cascada del cotizador (modelo/km dependientes)
  poblarCotizador();
  S.hasNovedad=false; S.hasWG=false; S.teleAcepta=false; S.adicionales.clear();
  S.checks = new Set(CHECKS_DEF);   // CHECKS_DEF ahora vacío → botones del taller apagados (punto 11)
  $('#novSw').classList.remove('warn'); $('#wgSw').classList.remove('on');
  $('#novedadF').classList.add('hidden'); $('#wgF').classList.add('hidden'); $('#accF').classList.add('hidden');
  $('#teleF')?.classList.add('hidden'); $('#teleAceptaSw')?.classList.remove('on');
  $('#wegoOk').classList.remove('hidden'); $('#wegoBlocked').classList.add('hidden');
  $$('.pill[data-ad]').forEach(p => p.classList.remove('on'));
  $$('.pill[data-chk]').forEach(p => p.classList.remove('on'));   // todos apagados
  // repoblar selects dependientes + horas
  _ultCiudadPanel = null; _ultMotivoPanel = null;
  $('#asesorTallerOtroWrap')?.classList.add('hidden');
  poblarAsesorTaller('');
  poblarWgQuien();
  poblarHoras();
  pickRes($('#resP .pill[data-r="agenda"]'));
}

// =============================================================
//  OMNIBOX (búsqueda global ligera)
// =============================================================
function buildSearchIndex(){
  const idx = [];
  (DATA.inbound||[]).forEach(p => idx.push({t:`Paso ${p.paso} · ${p.titulo}`, k:'Inbound', go:'inbound'}));
  (DATA.outbound||[]).forEach(o => idx.push({t:o.titulo, k:'Outbound', go:'outbound'}));
  (DATA.plantillas||[]).forEach(p => idx.push({t:`${p.id} · ${p.titulo}`, k:'WhatsApp', go:'whatsapp'}));
  (DATA.conocimiento||[]).forEach(f => idx.push({t:f.titulo, k:'Conocimiento', go: f.cat==='operativo'?'manuales':'productos', extra:(f.tags||[]).join(' ')}));
  (DATA.sedes||[]).forEach(s => idx.push({t:`Sede ${s.nombre}`, k:'Sede', go:'contactos', extra:s.direccion}));
  (DATA.escalamiento||[]).forEach(g => g.items.forEach(it => idx.push({t:`${it.nombre} — ${it.cargo}`, k:'Contacto', go:'contactos', extra:it.tel})));
  (DATA.extensiones||[]).forEach(x => idx.push({t:`${x.nombre} (ext ${x.ext})`, k:'Extensión', go:'contactos'}));
  (DATA.vip||[]).forEach(v => idx.push({t:v.nombre, k:'VIP', go:'vip', extra:v.placa}));
  (DATA.campanias||[]).forEach(c => idx.push({t:c.titulo, k:'Campaña', go:'campanias'}));
  [['Cotizador','Panel','inbound'],['Calificador de leads','Comercial','leads']].forEach(([t,k,go]) => idx.push({t,k,go}));
  return idx;
}
function omniSearch(q){
  const res = $('#omniRes');
  q = q.trim().toLowerCase();
  if (!q) { res.classList.remove('show'); res.innerHTML=''; return; }
  const hits = buildSearchIndex().filter(i => (i.t + ' ' + (i.extra||'')).toLowerCase().includes(q)).slice(0, 12);
  if (!hits.length) { res.innerHTML = `<div class="omni-item"><span style="color:var(--tx3)">Sin resultados</span></div>`; res.classList.add('show'); omniClientes(q); return; }
  res.innerHTML = hits.map(h => `<div class="omni-item" data-go="${h.go}"><i class="fas fa-arrow-right" style="font-size:10px;color:var(--tx3)"></i>${esc(h.t)}<span class="k">${esc(h.k)}</span></div>`).join('');
  res.classList.add('show');
  $$('#omniRes .omni-item[data-go]').forEach(el => el.addEventListener('click', () => {
    goTo(el.dataset.go); res.classList.remove('show'); $('#omniInput').value='';
  }));
  omniClientes(q);   // sugiere clientes reales si parece placa/teléfono (async)
}

// =============================================================
//  EXPONER HANDLERS USADOS EN onclick INLINE
// =============================================================
function goToInternos(){ goTo('internos'); }
Object.assign(window, { u, pickRes, togNovedad, togWego, togAd, togChk, switchTab, cpText, cpEvo, copyMsg, downloadCard, saveGestion, closeModoTV, openModoTV, openTVConfig, cancelarCasoActivo, goToInternos, goToSeguimientos, onAsesorTaller, onAlertaTipo, togAlCiudad, onCotMarca, onCotCombustion, onCotModelo, togTeleAcepta });

// =============================================================
//  INIT
// =============================================================
function init(){
  $('#googleLoginBtn').addEventListener('click', () => signInWithGoogle());
  $('#themeBtn').addEventListener('click', togTheme);
  $('#userChip').addEventListener('click', () => { if (confirm('¿Cerrar sesión?')) logout(); });
  $('#resetBtn').addEventListener('click', resetPanel);
  $$('.ni[data-v]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.v)));
  $('#omniInput').addEventListener('input', e => omniSearch(e.target.value));
  document.addEventListener('click', e => { if (!e.target.closest('.omni')) $('#omniRes').classList.remove('show'); });
  // Cerrar modal al click en el backdrop o con Escape
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') modalClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') modalClose(); });
  $('#ftVer').textContent = 'v' + DATA.config.version;
  actualizarModoFooter();

  // La sesión la maneja Supabase Auth (persistSession). initAuth decide entre
  // mostrar el login o entrar directo si ya hay sesión válida.
  initAuth();
}
init();
