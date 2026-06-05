// =============================================================
//  app.js — Consola CETA Armotor  (ES Module)
//  Lógica: autenticación + roles, navegación, panel de cierre
//  unificado con estado reactivo (S), cotizador local y salidas.
// =============================================================
import { DATA } from './data.js?v=1.15.2';

// ---------- Estado global (fuente única de verdad) ----------
const S = {
  user: null,                 // usuario logueado {id,nombre,alias,rol}
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
//  USUARIOS (con override de localStorage para PINs/edición)
// =============================================================
const LS_USERS = 'ceta_usuarios';
const LS_SESSION = 'ceta_session';

const LS_USERS_SEED = 'ceta_usuarios_seed';
// Versión del seed de data.js. Súbela cuando cambies DATA.usuarios y quieras
// que el cambio llegue a navegadores que ya tengan usuarios en localStorage.
const USERS_SEED_VERSION = 4;

function getUsuarios(){
  let ov = null;
  try { ov = JSON.parse(localStorage.getItem(LS_USERS) || 'null'); } catch {}
  const seedVer = parseInt(localStorage.getItem(LS_USERS_SEED) || '0', 10);

  if (!Array.isArray(ov) || !ov.length) {
    // primera vez: sembrar desde data.js
    const seed = DATA.usuarios.map(u => ({...u}));
    saveUsuarios(seed, { noSync:true });
    localStorage.setItem(LS_USERS_SEED, String(USERS_SEED_VERSION));
    return seed;
  }

  // Migración de seed: SOLO agrega perfiles base nuevos que falten (por id).
  // NO pisa nombre/alias/rol de los existentes — la fuente de verdad de las
  // ediciones es el coordinador (y el Sheet compartido), no el seed de data.js.
  if (seedVer < USERS_SEED_VERSION) {
    const ids = new Set(ov.map(u => u.id));
    DATA.usuarios.forEach(s => { if (!ids.has(s.id)) ov.push({ ...s }); });
    saveUsuarios(ov, { noSync:true });
    localStorage.setItem(LS_USERS_SEED, String(USERS_SEED_VERSION));
    return sanearUsuarios(ov);
  }

  return sanearUsuarios(ov);
}

// AUTO-REPARACIÓN: garantiza que la lista de usuarios sea usable.
//  - Si faltan perfiles base del seed (lista incompleta/corrupta), los RE-AGREGA
//    conservando los que el coordinador haya editado o creado.
//  - Descarta entradas inválidas (sin id, sin nombre, sin rol o sin PIN de 4 dígitos).
//  - Si todos los del seed están inactivos (login quedaría vacío), reactiva los base.
function sanearUsuarios(list){
  if (!Array.isArray(list)) list = [];
  // 1) limpiar entradas corruptas
  let limpia = list.filter(u => u && u.id != null && u.nombre && u.rol && /^\d{4}$/.test(String(u.pin||'')));
  // 2) re-agregar perfiles del seed que falten (por id), sin pisar los editados
  const ids = new Set(limpia.map(u => u.id));
  let faltaron = false;
  DATA.usuarios.forEach(s => { if (!ids.has(s.id)) { limpia.push({ ...s }); faltaron = true; } });
  // 3) si no quedó ningún usuario activo, reactivar los del seed (evita login vacío)
  if (!limpia.some(u => u.activo)) {
    limpia = limpia.map(u => DATA.usuarios.some(s => s.id === u.id) ? { ...u, activo: true } : u);
    faltaron = true;
  }
  // 4) persistir solo si hubo reparación (sin re-subir al Sheet: es saneo local)
  if (faltaron || limpia.length !== list.length) saveUsuarios(limpia, { noSync:true });
  return limpia;
}
function saveUsuarios(list, opciones){
  localStorage.setItem(LS_USERS, JSON.stringify(list));
  // Subir al Sheet para que el resto de dispositivos vean los mismos perfiles.
  // (opciones.noSync evita el envío en escrituras internas de saneo/migración).
  if (!(opciones && opciones.noSync) && typeof getApiUrl === 'function' && getApiUrl()) {
    try { apiCall('guardarUsuarios', { usuarios: list }, 'POST').catch(()=>{}); } catch {}
  }
}

// Baja la lista de usuarios del Sheet (fuente de verdad compartida) y la fusiona
// con la local. El Sheet manda. Se llama al entrar si hay conexión.
async function sincronizarUsuarios(){
  if (!getApiUrl()) return false;
  try {
    const r = await apiCall('listarUsuarios');
    if (r && r.success && Array.isArray(r.usuarios) && r.usuarios.length) {
      const saneada = sanearUsuarios(r.usuarios);   // valida/repara lo que venga del Sheet
      localStorage.setItem(LS_USERS, JSON.stringify(saneada));
      localStorage.setItem(LS_USERS_SEED, String(USERS_SEED_VERSION));
      return true;
    } else if (r && r.success) {
      // El Sheet está vacío (primera vez): sube la lista local como base inicial.
      const local = getUsuarios();
      apiCall('guardarUsuarios', { usuarios: local }, 'POST').catch(()=>{});
    }
  } catch {}
  return false;
}

// =============================================================
//  AUTENTICACIÓN
// =============================================================
function renderLoginUsers(){
  const sel = $('#loginUser');
  if (!sel) return;
  sel.innerHTML = '';
  const activos = getUsuarios().filter(u => u.activo);
  if (!activos.length) {
    // Salvavidas extremo: si aún no hay usuarios, sembrar desde el seed.
    DATA.usuarios.forEach(u => activos.push({ ...u }));
    saveUsuarios(activos);
  }
  activos.forEach(u => {
    const o = document.createElement('option');
    o.value = u.id; o.textContent = `${u.nombre} · ${rolLabel(u.rol)}`;
    sel.appendChild(o);
  });
}

function doLogin(){
  const id = +$('#loginUser').value;
  const pin = $('#loginPin').value.trim();
  const err = $('#loginErr');
  const user = getUsuarios().find(u => u.id === id && u.activo);
  if (!user) { err.textContent = 'Usuario no válido.'; return; }
  if (pin !== String(user.pin)) { err.textContent = 'PIN incorrecto.'; $('#loginPin').value=''; return; }
  err.textContent = '';
  S.user = { id:user.id, nombre:user.nombre, alias:user.alias, rol:user.rol };
  localStorage.setItem(LS_SESSION, JSON.stringify(S.user));
  enterApp();
}

function logout(){
  localStorage.removeItem(LS_SESSION);
  S.user = null;
  const vi = $('#v-internos'); if (vi) vi.dataset.built = '';  // forzar reconstrucción para el próximo usuario
  $('#appRoot').style.display = 'none';
  $('#loginScreen').style.display = 'flex';
  $('#loginPin').value = '';
  renderLoginUsers();
}

function restoreSession(){
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    if (s && s.id) {
      // revalidar contra lista actual (por si cambió rol/activo)
      const fresh = getUsuarios().find(u => u.id === s.id && u.activo);
      if (fresh) { S.user = {id:fresh.id, nombre:fresh.nombre, alias:fresh.alias, rol:fresh.rol}; return true; }
    }
  } catch {}
  return false;
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

  // Auto-sincronizar gestiones del equipo al entrar (si hay conexión).
  if (getApiUrl()) sincronizarGestiones({ silencioso:true });

  // Refresco de temporizadores de la bandeja (SLA 5 min) cada 30 s.
  if (!window._slaTimer) window._slaTimer = setInterval(() => {
    if ($('#v-internos')?.classList.contains('active')) renderBandeja();
    updateInternosBadges();
  }, 30000);
  // Auto-sincronización periódica con el Sheet cada 3 min (gestiones + usuarios).
  if (!window._syncTimer) window._syncTimer = setInterval(() => {
    if (getApiUrl()) { sincronizarGestiones({ silencioso:true }); sincronizarUsuarios(); }
  }, 180000);
}

// =============================================================
//  ROLES Y PERMISOS
// =============================================================
function rolLabel(r){
  return { coordinador:'Coordinador', analista:'Analista', asesor_cc:'Asesor Taller', asesor_digital:'Asesor Digital' }[r] || r;
}
function perms(){ return DATA.permisos[S.user?.rol] || {}; }
function can(p){ return !!perms()[p]; }

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

// Procesa el CSV: crea TODOS local primero (rápido), luego los envía al Sheet
// UNO POR UNO con espera, para no saturar Apps Script (que es de un solo hilo).
function procesarCSV(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const out = $('#csvResultado');
  const reader = new FileReader();
  reader.onload = async () => {
    const filas = parseCSV(String(reader.result || ''));
    if (!filas.length) { out.innerHTML = `<div class="al wr" style="font-size:11px;padding:8px"><i class="fas fa-triangle-exclamation"></i><div>El archivo está vacío o no tiene filas válidas.</div></div>`; return; }
    const requeridas = ['placa','nombre','ciudad','servicio'];
    const creados = []; const errores = [];
    filas.forEach((f, i) => {
      const falta = requeridas.filter(k => !(f[k] && f[k].trim()));
      if (falta.length) { errores.push(`Fila ${i+2}: falta ${falta.join(', ')}`); return; }
      const g = crearCasoInterno({
        tipoRadicacion: 'Nuevo',
        placa: f.placa.toUpperCase().trim(),
        nombre: f.nombre.trim(),
        telefono: (f.telefono||'').trim(),
        ciudad: (f.ciudad||'').trim(),
        servicio: (f.servicio||'').trim(),
        grupoChat: (f.grupoChat||'').trim(),
        notaSolicitante: (f.nota||'').trim()
      }, { masivo: true });
      creados.push(g);
    });
    e.target.value = '';   // permite recargar el mismo archivo
    renderBandeja(); updateInternosBadges();

    // Envío secuencial al Sheet (si hay conexión), con progreso y reintento.
    if (getApiUrl() && creados.length) {
      let enviados = 0, fallos = 0;
      for (const g of creados) {
        out.innerHTML = `<div class="al in" style="font-size:11px;padding:8px"><i class="fas fa-spinner fa-spin"></i><div>Sincronizando con Google… ${enviados+1}/${creados.length}</div></div>`;
        let ok = false;
        for (let intento = 0; intento < 2 && !ok; intento++) {     // 1 reintento
          try { const r = await apiCall('guardarGestion', g, 'POST'); ok = !r || r.success !== false; }
          catch { ok = false; }
          if (!ok) await new Promise(res => setTimeout(res, 400));
        }
        ok ? enviados++ : fallos++;
      }
      out.innerHTML = `<div class="al ${(errores.length||fallos)?'wr':'in'}" style="font-size:11px;padding:8px"><i class="fas fa-circle-check"></i><div><strong>${creados.length} casos cargados y asignados.</strong><br>Google Sheet: ${enviados} enviados${fallos?`, ${fallos} fallaron (quedaron en local, usa Sincronizar)`:''}.${errores.length?`<br>${errores.length} filas con error:<br>${errores.slice(0,5).map(esc).join('<br>')}${errores.length>5?'<br>…':''}`:''}</div></div>`;
    } else {
      out.innerHTML = `<div class="al ${errores.length?'wr':'in'}" style="font-size:11px;padding:8px"><i class="fas fa-circle-check"></i><div><strong>${creados.length} casos cargados (local).</strong>${errores.length?`<br>${errores.length} con error:<br>${errores.slice(0,5).map(esc).join('<br>')}${errores.length>5?'<br>…':''}`:''}</div></div>`;
    }
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
    $('#dupCrear').addEventListener('click', () => { modalClose(); crearCasoInterno(payload); });
    $('#dupNota').addEventListener('click', () => { modalClose(); openCaseDetail(dup.id); });
    return;
  }
  crearCasoInterno(payload);
}

// opciones.masivo = true → NO envía al Sheet aquí ni toca la UI (lo hace el llamador
// de forma secuencial). Devuelve el registro creado.
function crearCasoInterno(payload, opciones){
  opciones = opciones || {};
  const asign = asignarCaso(payload.placa, payload.servicio);
  const now = Date.now();
  const g = {
    ...payload,
    id: newCaseId(),
    origen: 'Interno',
    resultado: 'pendiente',
    asignadoId: asign.asesorId, asignadoAlias: asign.alias, asignMotivo: asign.motivo, cola: asign.cola,
    asesorCeta: asign.alias,         // dueño visible = asesor asignado
    createdBy: asign.asesorId,       // el caso pertenece al asesor asignado (puede editarlo)
    createdByAlias: asign.alias,
    radicadoPor: S.user?.alias || '',
    _ts: now, _updated: now,
    historial: [{ ts: now, tipo: 'Creado', autor: S.user?.alias || '', resultado: 'pendiente', nota: `Radicado por ${S.user?.alias||'—'} → asignado a ${asign.alias} (${asign.motivo})` }]
  };
  const list = getGestionesLocal();
  list.unshift(g);
  localStorage.setItem(LS_GESTIONES, JSON.stringify(list.slice(0, 500)));
  if (opciones.masivo) return g;   // el envío al Sheet + UI lo maneja el llamador
  // Caso individual: sync al Sheet si hay conexión (no bloquea la UI)
  if (getApiUrl()) { apiCall('guardarGestion', g, 'POST').catch(()=>{}); }
  toast(`✅ Caso asignado a ${asign.alias} · ${asign.motivo}`);
  limpiarFormInternos();
  renderBandeja(); updateInternosBadges();   // refresca solo el listado, no el formulario
  return g;
}

// Limpia los campos del formulario de radicación tras crear un caso.
function limpiarFormInternos(){
  ['inPlaca','inNombre','inTelefono','inNota'].forEach(id => { const e = $('#'+id); if (e) e.value = ''; });
  ['inTipo','inCiudad','inServicio','inGrupo'].forEach(id => { const e = $('#'+id); if (e) e.selectedIndex = 0; });
  const av = $('#inDupAviso'); if (av) av.innerHTML = '';
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
const RESULT_LABEL = { pendiente:'Pendiente', agenda:'Agendado', seg:'Seguimiento', noc:'No contesta', sinKm:'Sin km', otroTaller:'Otro taller', noContactar:'No contactar' };
const RESULT_COLOR = { pendiente:'#a855f7', agenda:'var(--ok)', seg:'var(--in)', noc:'var(--wr)', sinKm:'var(--gd)', otroTaller:'var(--tx3)', noContactar:'var(--ac)' };
let ctrlFiltro = { asesor:'', resultado:'' };

// Columnas configurables del Control de Gestión (coordinador).
// 'def' = visible por defecto. El render() las pinta en este orden.
const CTRL_COLUMNS = [
  { key:'hora',        label:'Hora',          def:true,  render: g => `<span style="font-family:var(--fm);font-size:11px">${esc(fmtHora(g._ts))}</span>` },
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
  let rows = gestionesVisibles();
  const asesores = [...new Set(getGestionesLocal().map(g => g.asesorCeta).filter(Boolean))];
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
      <div class="ff" style="min-width:160px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Asesor</label>
        <select id="ctrlAsesor" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"><option value="">Todos</option>${asesores.map(a=>`<option ${ctrlFiltro.asesor===a?'selected':''}>${esc(a)}</option>`).join('')}</select></div>
      <div class="ff" style="min-width:160px"><label style="font-size:9px;color:var(--tx3);text-transform:uppercase">Resultado</label>
        <select id="ctrlResultado" style="border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:6px;border-radius:5px"><option value="">Todos</option>${Object.entries(RESULT_LABEL).map(([k,v])=>`<option value="${k}" ${ctrlFiltro.resultado===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <button class="btn btn-gh" id="ctrlClear"><i class="fas fa-filter-circle-xmark"></i> Limpiar</button>
      <div style="margin-left:auto;display:flex;gap:6px">
        ${getApiUrl()?`<button class="btn btn-gh" id="ctrlSync" title="Traer gestiones del equipo desde Google"><i class="fas fa-cloud-arrow-down"></i> Sincronizar</button>`:''}
        ${can('config')?`<button class="btn btn-gh" id="ctrlCols" title="Configurar columnas"><i class="fas fa-gear"></i> Columnas</button>`:''}
        ${can('modoTV')?`<button class="btn btn-ac" id="ctrlTV"><i class="fas fa-tv"></i> Modo TV</button>`:''}
      </div>
    </div>
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
    <div class="fb">
      ${fil.length?(() => {
        const cols = getCtrlCols().map(k => CTRL_COLUMNS.find(c=>c.key===k)).filter(Boolean);
        const esCoord = S.user?.rol === 'coordinador';
        return `<table class="tbl"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}${esCoord?'<th style="width:30px"></th>':''}<th style="width:24px"></th></tr></thead><tbody>
          ${fil.map(g=>`<tr class="ctrl-row" data-id="${esc(g.id)}" style="cursor:pointer">${cols.map(c=>`<td>${c.render(g)}</td>`).join('')}${esCoord?`<td><button class="btn btn-gh ctrl-reasignar" data-id="${esc(g.id)}" title="Reasignar a otro asesor" style="padding:3px 7px"><i class="fas fa-people-arrows"></i></button></td>`:''}<td style="color:var(--tx3)"><i class="fas fa-chevron-right" style="font-size:10px"></i></td></tr>`).join('')}
        </tbody></table>`;
      })():emptyState('fa-inbox','Sin gestiones','Aún no hay gestiones registradas. Las que guardes en el panel derecho aparecerán aquí.')}
    </div>
    ${graficasHTML(fil)}`;
  const a = $('#ctrlAsesor'); if (a) a.addEventListener('change', e => { ctrlFiltro.asesor = e.target.value; renderControl(); });
  const rr = $('#ctrlResultado'); if (rr) rr.addEventListener('change', e => { ctrlFiltro.resultado = e.target.value; renderControl(); });
  const cl = $('#ctrlClear'); if (cl) cl.addEventListener('click', () => { ctrlFiltro = { asesor:'', resultado:'' }; renderControl(); });
  const tv = $('#ctrlTV'); if (tv) tv.addEventListener('click', openModoTV);
  const cog = $('#ctrlCols'); if (cog) cog.addEventListener('click', openColsConfig);
  const syn = $('#ctrlSync'); if (syn) syn.addEventListener('click', sincronizarGestiones);
  $$('#v-control .ctrl-reasignar').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openReasignar(b.dataset.id); }));
  $$('#v-control .ctrl-row').forEach(tr => tr.addEventListener('click', () => openCaseDetail(tr.dataset.id)));
}

// Trae las gestiones del Sheet (todo el equipo) y las fusiona con las locales por id.
// Sincronización BIDIRECCIONAL:
//  1) baja las del Sheet y las fusiona en local
//  2) sube al Sheet (uno por uno) las locales que aún no están allá
async function sincronizarGestiones(opts){
  opts = opts || {};
  const silencioso = !!opts.silencioso;
  if (!getApiUrl()) { if (!silencioso) toast('Sin conexión configurada'); return; }
  const syn = $('#ctrlSync');
  const setBtn = (html, dis) => { if (syn) { syn.innerHTML = html; syn.disabled = !!dis; } };
  const aviso = (m) => { if (!silencioso) toast(m); };
  setBtn('<i class="fas fa-spinner fa-spin"></i> Sincronizando…', true);
  try {
    const r = await apiCall('listarGestiones');
    if (!r || !r.success || !Array.isArray(r.rows)) { aviso('El servidor no devolvió datos'); setBtn('<i class="fas fa-cloud-arrow-down"></i> Sincronizar'); return; }

    const locales = getGestionesLocal();
    const porId = {};
    locales.forEach(g => { if (g.id) porId[g.id] = g; });
    const idsEnSheet = new Set();
    let bajadas = 0;
    r.rows.forEach(row => {
      if (!row.id) return;
      idsEnSheet.add(String(row.id));
      if (typeof row.historialJSON === 'string' && row.historialJSON) {
        try { row.historial = JSON.parse(row.historialJSON); } catch { row.historial = []; }
      }
      if (!row._ts) row._ts = Date.now();
      if (!porId[row.id]) { porId[row.id] = row; bajadas++; }
      else { porId[row.id] = { ...porId[row.id], ...row }; }  // el Sheet manda en conflicto
    });
    const fusion = Object.values(porId).sort((a,b)=>(b._ts||0)-(a._ts||0));
    localStorage.setItem(LS_GESTIONES, JSON.stringify(fusion.slice(0,1000)));

    // 2) Subir las locales que NO están en el Sheet (uno por uno, con reintento).
    const faltantes = fusion.filter(g => g.id && !idsEnSheet.has(String(g.id)));
    let subidas = 0, fallos = 0;
    for (let i = 0; i < faltantes.length; i++) {
      setBtn(`<i class="fas fa-spinner fa-spin"></i> Subiendo ${i+1}/${faltantes.length}`, true);
      let ok = false;
      for (let intento = 0; intento < 2 && !ok; intento++) {
        try { const rr = await apiCall('guardarGestion', faltantes[i], 'POST'); ok = !rr || rr.success !== false; }
        catch { ok = false; }
        if (!ok) await new Promise(res => setTimeout(res, 400));
      }
      ok ? subidas++ : fallos++;
    }
    setBtn('<i class="fas fa-cloud-arrow-down"></i> Sincronizar');
    // refrescar todo lo que depende de las gestiones
    if ($('#v-control')?.classList.contains('active')) renderControl();
    if ($('#v-internos')?.dataset.built === '1') renderBandeja();
    if ($('#v-home')?.classList.contains('active')) renderHome();
    updateInternosBadges();
    aviso(`✅ Sincronizado · ${bajadas} bajadas, ${subidas} subidas${fallos?`, ${fallos} fallaron`:''}`);
  } catch {
    setBtn('<i class="fas fa-cloud-arrow-down"></i> Sincronizar');
    aviso('⚠️ No se pudo sincronizar (revisa la conexión)');
  }
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
        ${rotacionPool().map(u=>`<option value="${u.id}" ${u.id===g.asignadoId?'disabled':''}>${esc(u.alias)} (${esc(u.nombre)})${u.id===g.asignadoId?' · actual':''}</option>`).join('')}
      </select></div>
    </div>
    <div class="modal-foot"><button class="btn btn-gh" data-modal-close>Cancelar</button><button class="btn btn-ac" id="reGo"><i class="fas fa-check"></i> Reasignar</button></div>`);
  $('#reGo').addEventListener('click', () => {
    const nid = +($('#reSel').value || 0);
    if (!nid) { toast('Elige un asesor'); return; }
    const r = reasignarCaso(id, nid);
    if (r) { modalClose(); renderControl(); renderInternos(); updateInternosBadges(); toast(`✅ Reasignado a ${r.asignadoAlias}`); }
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
const EDITABLE_RESULTS = Object.keys(RESULT_LABEL);
function openCaseDetail(id){
  const g = getGestionesLocal().find(x => x.id === id);
  if (!g) { toast('Caso no encontrado'); return; }
  const editable = canEditCase(g);
  const ro = editable ? '' : 'disabled';
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

      ${(editable && g.origen==='Interno' && g.resultado==='pendiente')?`<button class="btn btn-ac btn-big" id="mdGestionar" style="margin-bottom:12px"><i class="fas fa-headset"></i> Gestionar en el panel →</button>`:''}

      ${S.user?.rol==='coordinador'?`<div class="sub-l"><i class="fas fa-people-arrows"></i>Reasignar caso</div>
      <div class="rr"><div class="ff"><select id="mdReasignar">
        <option value="">— Mantener: ${esc(g.asignadoAlias||g.asesorCeta||'—')} —</option>
        ${rotacionPool().map(u=>`<option value="${u.id}" ${u.id===g.asignadoId?'disabled':''}>${esc(u.alias)} (${esc(u.nombre)})${u.id===g.asignadoId?' · actual':''}</option>`).join('')}
      </select></div><div class="ff" style="flex:0 0 auto"><button class="btn btn-gh" id="mdReasignarBtn" style="margin-top:14px"><i class="fas fa-people-arrows"></i> Reasignar</button></div></div>`:''}

      <div class="sub-l"><i class="fas fa-circle-info"></i>Datos del caso</div>
      <div class="rr"><div class="ff"><label>Nombre</label><input value="${esc(g.nombre||'')}" disabled></div><div class="ff"><label>Placa</label><input class="mono" value="${esc(g.placa||'')}" disabled></div></div>
      <div class="rr"><div class="ff"><label>Teléfono</label><input id="mdTelefono" value="${esc(g.telefono||'')}" ${ro}></div><div class="ff"><label>Km actual</label><input id="mdKmActual" value="${esc(g.kmActual||'')}" ${ro}></div></div>
      <div class="rr"><div class="ff"><label>Ciudad</label><input value="${esc(g.ciudad||'')}" disabled></div><div class="ff"><label>Servicio</label><input value="${esc(g.servicio||'')}" disabled></div></div>

      <div class="sub-l" style="margin-top:10px"><i class="fas fa-flag"></i>Estado / Resultado</div>
      <div class="ff"><select id="mdResultado" ${ro}>${EDITABLE_RESULTS.map(r=>`<option value="${r}" ${g.resultado===r?'selected':''}>${esc(RESULT_LABEL[r])}</option>`).join('')}</select></div>

      <div class="sub-l" style="margin-top:10px"><i class="fas fa-calendar-check"></i>Cita en taller</div>
      <div class="rr"><div class="ff"><label>Fecha cita</label><input type="date" id="mdFechaCita" value="${esc(g.fechaCita||'')}" ${ro}></div><div class="ff"><label>Hora cita</label><input type="time" id="mdHoraCita" value="${esc(g.horaCita||'')}" ${ro}></div></div>
      <div class="rr full"><div class="ff"><label>Asesor servicio (taller)</label><input id="mdAsesorTaller" value="${esc(g.asesorTaller||'')}" ${ro}></div></div>

      ${editable?`<div class="sub-l" style="margin-top:10px"><i class="fas fa-pen"></i>Nueva nota / comentario</div>
      <div class="ff"><input id="mdNota" placeholder="Ej: Cliente confirmó cita para el viernes…"></div>`:''}

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
      ${editable?`<button class="btn btn-ac" id="mdSave"><i class="fas fa-floppy-disk"></i> Guardar cambios</button>`:''}
    </div>`);

  // Reasignar (solo coordinador) — disponible aunque el modal sea de otro asesor.
  const reBtn = $('#mdReasignarBtn');
  if (reBtn) reBtn.addEventListener('click', () => {
    const nid = +($('#mdReasignar').value || 0);
    if (!nid) { toast('Elige un asesor'); return; }
    const r = reasignarCaso(id, nid);
    if (r) { modalClose(); renderControl(); renderInternos(); updateInternosBadges(); toast(`✅ Reasignado a ${r.asignadoAlias}`); }
  });

  if (editable) {
    const gest = $('#mdGestionar');
    if (gest) gest.addEventListener('click', () => { modalClose(); gestionarCaso(id); });
    $('#mdSave').addEventListener('click', () => {
      const changes = {
        telefono: $('#mdTelefono').value.trim(),
        kmActual: $('#mdKmActual').value.trim(),
        resultado: $('#mdResultado').value,
        fechaCita: $('#mdFechaCita').value,
        horaCita: $('#mdHoraCita').value,
        asesorTaller: $('#mdAsesorTaller').value.trim()
      };
      const nota = $('#mdNota').value.trim();
      updateGestionLocal(id, changes, nota);
      modalClose(); renderControl(); renderInternos(); updateInternosBadges(); toast('✅ Caso actualizado');
    });
  }
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
function openModoTV(){
  const ov = $('#tvOverlay');
  ov.classList.add('show');
  renderTV();
  if (ov.requestFullscreen) ov.requestFullscreen().catch(()=>{});
  tvTimer = setInterval(renderTV, 60000);
}
function closeModoTV(){
  $('#tvOverlay').classList.remove('show');
  if (tvTimer) { clearInterval(tvTimer); tvTimer = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
}
function renderTV(){
  const rows = gestionesVisibles();
  const total = rows.length;
  const agend = rows.filter(g=>g.resultado==='agenda').length;
  const pend = total - agend;
  const porAsesor = {};
  rows.forEach(g => { porAsesor[g.asesorCeta||'—'] = (porAsesor[g.asesorCeta||'—']||0)+1; });
  const maxA = Math.max(1, ...Object.values(porAsesor));
  $('#tvBody').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div style="font-family:var(--fd);font-weight:800;font-size:28px"><span style="color:var(--ac)">ARMOTOR</span> CETA · Control de Gestión</div>
      <div style="font-family:var(--fm);font-size:24px">${new Date().toLocaleTimeString('es-CO')}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:28px">
      ${[['Gestiones del día',total,''],['Agendados',agend,'var(--ok)'],['Pendientes',pend,'var(--wr)']].map(([l,n,c])=>
        `<div style="background:var(--bgp);border:1px solid var(--bd);border-radius:12px;padding:24px;text-align:center"><div style="font-family:var(--fd);font-weight:800;font-size:54px;${c?`color:${c}`:''}">${n}</div><div style="font-size:14px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">${l}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px">
      <div style="background:var(--bgp);border:1px solid var(--bd);border-radius:12px;padding:18px">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">Últimas gestiones</div>
        ${rows.slice(0,10).map(g=>`<div style="display:flex;gap:14px;padding:8px 0;border-bottom:1px solid var(--bd);font-size:15px"><span style="font-family:var(--fm);color:var(--tx3);width:60px">${fmtHora(g._ts)}</span><span style="width:120px">${esc(g.asesorCeta||'—')}</span><span style="font-family:var(--fm);width:90px">${esc(g.placa||'—')}</span><span style="color:${RESULT_COLOR[g.resultado]||'var(--tx2)'};font-weight:600">${esc(RESULT_LABEL[g.resultado]||g.resultado||'—')}</span></div>`).join('') || '<div style="color:var(--tx3)">Sin gestiones aún.</div>'}
      </div>
      <div style="background:var(--bgp);border:1px solid var(--bd);border-radius:12px;padding:18px">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">Por asesor</div>
        ${Object.entries(porAsesor).sort((a,b)=>b[1]-a[1]).map(([a,n])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:15px"><div style="width:120px">${esc(a)}</div><div style="flex:1;background:var(--bgs);border-radius:5px;height:20px;overflow:hidden"><div style="width:${Math.round(n/maxA*100)}%;height:100%;background:var(--ac)"></div></div><div style="width:34px;text-align:right;font-family:var(--fm);font-weight:700">${n}</div></div>`).join('') || '<div style="color:var(--tx3)">—</div>'}
      </div>
    </div>`;
}

// =============================================================
//  CONFIG (gestión de usuarios — solo coordinador)
// =============================================================
const ROLES = ['coordinador','analista','asesor_cc','asesor_digital'];
const inpStyle = 'border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:5px 7px;border-radius:5px;font-size:11px;font-family:var(--f)';

function renderConfig(){
  if (!can('config')) return;
  const list = getUsuarios();
  $('#usersTable').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;color:var(--tx3)">${list.length} perfiles · puedes editar nombre, rol, PIN, activar/desactivar, agregar o eliminar.</div>
      <button class="btn btn-ac" id="cfgAdd"><i class="fas fa-user-plus"></i> Agregar perfil</button>
    </div>
    <table class="tbl"><thead><tr><th>Nombre completo</th><th>Alias</th><th>Rol</th><th>PIN</th><th>Activo</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr data-id="${u.id}">
      <td><input class="cfg-nombre" value="${esc(u.nombre)}" style="${inpStyle};width:150px"></td>
      <td><input class="cfg-alias" value="${esc(u.alias)}" style="${inpStyle};width:90px;font-family:var(--fm)" title="Al cambiar el alias, los casos de esa persona se re-vinculan automáticamente"></td>
      <td><select class="cfg-rol" style="${inpStyle}">${ROLES.map(r=>`<option value="${r}" ${u.rol===r?'selected':''}>${rolLabel(r)}</option>`).join('')}</select></td>
      <td><input class="cfg-pin" value="${esc(u.pin)}" maxlength="4" inputmode="numeric" style="${inpStyle};width:60px;font-family:var(--fm);text-align:center"></td>
      <td><label class="tog"><span class="tog-sw cfg-act ${u.activo?'on':''}"></span></label></td>
      <td style="white-space:nowrap"><button class="btn btn-ok cfg-save"><i class="fas fa-floppy-disk"></i></button> <button class="btn btn-gh cfg-del" title="Eliminar perfil"><i class="fas fa-trash" style="color:var(--ac)"></i></button></td>
    </tr>`).join('')}
    </tbody></table>`;

  $$('#usersTable .cfg-act').forEach(sw => sw.addEventListener('click', () => sw.classList.toggle('on')));

  $$('#usersTable .cfg-save').forEach(btn => btn.addEventListener('click', e => {
    const tr = e.target.closest('tr'); const id = +tr.dataset.id;
    const nombre = tr.querySelector('.cfg-nombre').value.trim();
    const alias = tr.querySelector('.cfg-alias').value.trim();
    const rol = tr.querySelector('.cfg-rol').value;
    const pin = tr.querySelector('.cfg-pin').value.trim();
    const activo = tr.querySelector('.cfg-act').classList.contains('on');
    if (!nombre) { toast('El nombre no puede estar vacío'); return; }
    if (!alias) { toast('El alias no puede estar vacío'); return; }
    if (!/^\d{4}$/.test(pin)) { toast('El PIN debe ser de 4 dígitos'); return; }
    const actual = getUsuarios();
    const aliasPrev = actual.find(u => u.id === id)?.alias || '';
    if (alias.toLowerCase() !== aliasPrev.toLowerCase() && actual.some(u => u.id !== id && u.alias.toLowerCase() === alias.toLowerCase())) {
      toast('Ya existe otro perfil con ese alias'); return;
    }
    const aplicar = () => {
      const list2 = getUsuarios().map(u => u.id===id ? {...u, nombre, alias, rol, pin, activo} : u);
      saveUsuarios(list2);
      if (aliasPrev && alias !== aliasPrev) relinkCasos(aliasPrev, alias, id);  // re-vincular casos históricos
      if (S.user && S.user.id === id) { S.user.nombre = nombre; S.user.alias = alias; S.user.rol = rol; localStorage.setItem(LS_SESSION, JSON.stringify(S.user)); applyRole(); renderHome(); }
      renderConfig(); toast('Perfil actualizado ✓');
    };
    // Si cambia el alias y la persona tiene casos, confirmar la re-vinculación.
    const nCasos = aliasPrev && alias !== aliasPrev ? contarCasosDeAlias(aliasPrev) : 0;
    if (nCasos > 0) {
      confirmModal('Cambiar alias',
        `Vas a cambiar el alias <strong>${esc(aliasPrev)}</strong> → <strong>${esc(alias)}</strong>.<br><br>Se re-vincularán <strong>${nCasos}</strong> caso(s) y la posición en la rotación a este nuevo alias. ¿Continuar?`,
        aplicar);
    } else { aplicar(); }
  }));

  $$('#usersTable .cfg-del').forEach(btn => btn.addEventListener('click', e => {
    const tr = e.target.closest('tr'); const id = +tr.dataset.id;
    const u = getUsuarios().find(x => x.id === id);
    if (S.user && S.user.id === id) { toast('No puedes eliminar tu propio perfil mientras lo usas'); return; }
    confirmModal(
      `Eliminar perfil`,
      `¿Eliminar el perfil <strong>${esc(u.nombre)}</strong> (${esc(u.alias)})? Sus casos históricos se conservan, pero ya no podrá iniciar sesión.<br><br>Si solo quiere pausarlo, mejor <strong>desactívelo</strong> con el interruptor.`,
      () => { saveUsuarios(getUsuarios().filter(x => x.id !== id)); renderConfig(); toast('Perfil eliminado'); }
    );
  }));

  $('#cfgAdd').addEventListener('click', openAddUser);
  renderAsesoresServicioConfig();
  renderListasConfig();
  renderConexionConfig();
  const bb = $('#btnBorrarCasos'); if (bb) bb.addEventListener('click', () => {
    confirmModal('Borrar gestiones', `Esto eliminará <strong>todas las gestiones guardadas en este navegador</strong> (casos, agendas, pendientes). No se puede deshacer.<br><br>Las del Google Sheet NO se tocan (esas se borran manual). ¿Continuar?`, () => {
      localStorage.removeItem(LS_GESTIONES);
      try { localStorage.removeItem('ceta_colas'); } catch {}
      toast('Gestiones locales borradas');
      renderControl(); if ($('#v-internos')?.dataset.built==='1') renderBandeja(); updateInternosBadges(); renderHome();
    });
  });
}

// Gestión de asesores de servicio por ciudad (coordinador).
const CIUDADES_PANEL = ['Pereira','Manizales','Armenia','Cartago','La Dorada'];
function renderAsesoresServicioConfig(){
  const box = $('#asesoresSrvTable'); if (!box) return;
  const data = getAsesoresServicio();
  box.innerHTML = `
    <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Estos nombres alimentan el campo «Asesor servicio (taller)» del panel, filtrados por la ciudad de la cita.</div>
    ${CIUDADES_PANEL.map(ciudad => {
      const lista = data[ciudad] || [];
      return `<div style="margin-bottom:12px">
        <div style="font-weight:600;font-size:12px;margin-bottom:4px"><i class="fas fa-location-dot" style="color:var(--ac);font-size:10px"></i> ${esc(ciudad)}</div>
        ${lista.length ? lista.map((n,idx) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <input class="srv-name" data-ciudad="${esc(ciudad)}" data-idx="${idx}" value="${esc(n)}" style="${inpStyle};flex:1">
          <button class="btn btn-gh srv-del" data-ciudad="${esc(ciudad)}" data-idx="${idx}" title="Quitar"><i class="fas fa-trash" style="color:var(--ac)"></i></button>
        </div>`).join('') : `<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">Sin asesores cargados.</div>`}
        <button class="btn btn-gh srv-add" data-ciudad="${esc(ciudad)}" style="margin-top:2px"><i class="fas fa-plus"></i> Agregar asesor</button>
      </div>`;
    }).join('')}
    <button class="btn btn-ac" id="srvSave" style="margin-top:6px"><i class="fas fa-floppy-disk"></i> Guardar asesores de servicio</button>`;

  $$('#asesoresSrvTable .srv-add').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.ciudad; const d = getAsesoresServicio(); (d[c] = d[c] || []).push(''); saveAsesoresServicio(d); renderAsesoresServicioConfig();
  }));
  $$('#asesoresSrvTable .srv-del').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.ciudad, i = +b.dataset.idx; const d = getAsesoresServicio();
    // tomar valores actuales del DOM antes de borrar, para no perder ediciones sin guardar
    leerSrvDom(d); d[c].splice(i,1); saveAsesoresServicio(d); renderAsesoresServicioConfig();
  }));
  $('#srvSave').addEventListener('click', () => {
    const d = getAsesoresServicio(); leerSrvDom(d);
    // limpiar vacíos
    Object.keys(d).forEach(c => { d[c] = (d[c]||[]).map(s=>s.trim()).filter(Boolean); });
    saveAsesoresServicio(d); renderAsesoresServicioConfig();
    // si el panel está abierto, refrescar su select
    _ultCiudadPanel = null; poblarAsesorTaller($('#asesorTallerSel')?.value || '');
    toast('Asesores de servicio actualizados ✓');
  });
}
// Lee los inputs de la tabla de asesores de servicio dentro del objeto dado.
function leerSrvDom(d){
  CIUDADES_PANEL.forEach(c => { if (d[c]) d[c] = d[c].map((_,i)=>{ const el = $(`#asesoresSrvTable .srv-name[data-ciudad="${c}"][data-idx="${i}"]`); return el ? el.value : d[c][i]; }); });
}

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

// Modal para agregar un perfil nuevo.
function openAddUser(){
  modalOpen(`
    <div class="modal-head"><h3><i class="fas fa-user-plus"></i> Nuevo perfil</h3><button class="ib" data-modal-close><i class="fas fa-xmark"></i></button></div>
    <div class="modal-body">
      <div class="ff" style="margin-bottom:8px"><label>Nombre completo</label><input id="auNombre" placeholder="Ej: Alejandro Castaño"></div>
      <div class="ff" style="margin-bottom:8px"><label>Alias (nombre corto, fijo)</label><input id="auAlias" placeholder="Ej: Alejandro"></div>
      <div class="rr"><div class="ff"><label>Rol</label><select id="auRol">${ROLES.map(r=>`<option value="${r}">${rolLabel(r)}</option>`).join('')}</select></div><div class="ff"><label>PIN (4 dígitos)</label><input id="auPin" maxlength="4" inputmode="numeric" class="mono" placeholder="0000"></div></div>
      <div class="al in" style="margin-top:8px;font-size:11px"><i class="fas fa-circle-info"></i><div>Solo los roles <strong>asesor taller</strong> participan en la rotación de Casos Internos.</div></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-gh" data-modal-close>Cancelar</button>
      <button class="btn btn-ac" id="auSave"><i class="fas fa-check"></i> Crear perfil</button>
    </div>`);
  $('#auSave').addEventListener('click', () => {
    const nombre = $('#auNombre').value.trim();
    const alias = $('#auAlias').value.trim();
    const rol = $('#auRol').value;
    const pin = $('#auPin').value.trim();
    if (!nombre || !alias) { toast('Nombre y alias son obligatorios'); return; }
    if (!/^\d{4}$/.test(pin)) { toast('El PIN debe ser de 4 dígitos'); return; }
    const list = getUsuarios();
    if (list.some(u => u.alias.toLowerCase() === alias.toLowerCase())) { toast('Ya existe un perfil con ese alias'); return; }
    const nuevoId = Math.max(0, ...list.map(u => u.id)) + 1;
    list.push({ id: nuevoId, nombre, alias, rol, pin, activo: true });
    saveUsuarios(list);
    modalClose(); renderConfig(); toast('Perfil creado ✓');
  });
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
  if (v === 'control') renderControl();   // refresca con las gestiones más recientes
  if (v === 'internos') renderInternos(); // refresca bandeja y temporizadores
  if (v === 'alertas' && can('config')) renderAlertas();
  if (v === 'home') { renderHome(); renderHomeAlertas(); }  // stats y alertas frescas al volver
}

// =============================================================
//  PANEL — selección de resultado y toggles
// =============================================================
function pickRes(b){
  if (!b) return;
  $$('#resP .pill').forEach(p => p.classList.remove('on'));
  b.classList.add('on'); S.resultado = b.dataset.r;
  // ocultar todos los sub-formularios de resultado
  ['noc-f','sinKm-f','otroTaller-f','seg-f','comunica-f','actualizar-f'].forEach(id => { const e=$('#'+id); if(e) e.classList.add('hidden'); });

  const r = S.resultado;
  const mostrar = id => $('#'+id) && $('#'+id).classList.remove('hidden');
  const ocultar = id => $('#'+id) && $('#'+id).classList.add('hidden');
  const todasSec = ['sCotiz','sNovedad','sWego','sAdic'];

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
// La URL efectiva: override de localStorage o la de data.js (vacía por defecto).
function getApiUrl(){
  const ov = (localStorage.getItem(LS_API_URL) || '').trim();
  return ov || (DATA.config.endpoints.base || '');
}
function setApiUrl(url){ localStorage.setItem(LS_API_URL, (url||'').trim()); }
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
  const out = ['<option value="">—</option>'];
  for (let h = 7; h <= 18; h++) {
    for (let m = 0; m < 60; m += 20) {
      if (h === 18 && m > 0) break;   // tope 18:00
      const hh = String(h).padStart(2,'0'), mm = String(m).padStart(2,'0');
      const ampm = h < 12 ? 'a.m.' : 'p.m.';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      out.push(`<option value="${hh}:${mm}">${h12}:${mm} ${ampm}</option>`);
    }
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

const LS_ASESORES_SRV = 'ceta_asesores_servicio';
function getAsesoresServicio(){
  try {
    const ov = JSON.parse(localStorage.getItem(LS_ASESORES_SRV) || 'null');
    if (ov && typeof ov === 'object') return ov;
  } catch {}
  return JSON.parse(JSON.stringify(DATA.asesoresServicio || {}));
}
function saveAsesoresServicio(obj){ localStorage.setItem(LS_ASESORES_SRV, JSON.stringify(obj)); }

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
  // VALOR = round(MO × (1-desc%)) + Repuestos + Embellecimiento
  const moDesc = Math.round(manoObra * (1 - desc/100));
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
function u(){
  syncState();
  // Si cambió la ciudad, repoblar asesor de taller + We Go (listas dependientes).
  const ciudadActual = ($('[data-f="ciudad"]')?.value || '').trim();
  if (ciudadActual !== _ultCiudadPanel) { _ultCiudadPanel = ciudadActual; poblarAsesorTaller(''); poblarWgQuien(); renderPanelAlertas(); }
  // Si cambió el motivo, re-evaluar si el cotizador debe mostrarse (punto 1).
  const motivoActual = ($('#motivoSel')?.value || '');
  if (motivoActual !== _ultMotivoPanel) { _ultMotivoPanel = motivoActual; aplicarVisibilidadCotizador(); }
  const f = S.f, r = S.resultado;
  const pla = (f.placa||'').toUpperCase(), tel = f.telefono||'';
  const pre = [pla, tel].filter(Boolean).join(' // ');
  const signos = DATA.tipificador.servicioSigno;
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

  if (r === 'agenda') {
    const serv = motivo.toUpperCase();
    const signo = signos[serv] ? ' ' + signos[serv] : '';
    mot = serv === 'MANTENIMIENTO' ? 'CAMBIO DE ACEITE' : serv;
    voz = (S.hasNovedad && f.novedad) ? f.novedad.toUpperCase() : 'MANTENIMIENTO PREVENTIVO';
    const valor = q.found ? q.texto.replace('$ ','') : 'CONSULTAR';
    const pts = [pre, f.kmActual?`${f.kmActual} KM`:'', `${f.modelo||''} ${kmTxt} $ ${valor} IVA INCLUIDO`.trim()];
    if (S.hasNovedad && f.novedad) pts.push('NOVEDAD: ' + f.novedad.toUpperCase());
    S.checks.forEach(c => pts.push(c));
    if (S.adicionales.has('telemetria')) pts.push(S.teleAcepta ? 'CONTRATA TELEMETRIA' : 'OFRECE TELEMETRIA');   // #10
    if (S.adicionales.has('accesorios') && f.accesorios) pts.push('ACCESORIOS: ' + f.accesorios.toUpperCase());
    if (S.hasWG) pts.push('APLICA WE GO' + (f.wgQuien?` (${f.wgQuien.toUpperCase()})`:''));
    // #12 embellecimiento con costo
    if (q.found && q.valorCombo > 0) pts.push(`EMBELLECIMIENTO ${(f.embellecimiento||'').toUpperCase()} $ ${fmtCOP(q.valorCombo).replace('$ ','')}`);
    if (f.srvAdicional) pts.push('SERV. ADICIONAL: ' + f.srvAdicional.toUpperCase());   // #13
    if (f.asesorTaller) pts.push('RECIBE: ' + f.asesorTaller.toUpperCase());
    if (f.observacion) pts.push('OBS: ' + f.observacion.toUpperCase());
    const ini = inicialesDe(S.user);
    nota = pts.filter(Boolean).join(' // ') + ` // CALL CENTER${signo}${ini?` /${ini}`:''}`;

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
    nota = [pre, f.tipoNoc||'NO CONTESTA', f.marcaciones||'1 CONTACTO', 'ENVIO PLANTILLA'].filter(Boolean).join(' // ');
    cli = 'Hola 👋 Le saludamos de Armotor. Intentamos comunicarnos sin éxito. Cuando esté disponible, con gusto le atendemos.';
  } else if (r === 'seg') {
    mot = 'CLIENTE OCUPADO'; voz = 'SOLICITA LLAMAR EN OTRO MOMENTO';
    const segPts = [pre, 'SE REPROGRAMA CONTACTO'];
    if (f.segFecha || f.segHora) segPts.push('LLAMAR ' + [f.segFecha, f.segHora].filter(Boolean).join(' ').toUpperCase());
    if (S.hasNovedad && f.novedad) { segPts.push('NOVEDAD: ' + f.novedad.toUpperCase()); voz = f.novedad.toUpperCase(); }  // #4
    if (f.segObs) segPts.push('OBS: ' + f.segObs.toUpperCase());   // #3
    nota = segPts.filter(Boolean).join(' // ');
    cli = 'Quedamos en contacto. Cuando lo prefiera retomamos su solicitud. 😊';
  } else if (r === 'comunica') {
    // #5 Cliente se comunica con sub-motivo
    const sub = (DATA.tipificador.comunicaSubmotivos || {})[f.comunicaSub] || {};
    mot = sub.motivo || 'CLIENTE SE COMUNICA'; voz = sub.voz || 'CLIENTE SE COMUNICA';
    const cPts = [pre, mot];
    if (f.comunicaObs) cPts.push('OBS: ' + f.comunicaObs.toUpperCase());
    nota = cPts.filter(Boolean).join(' // ');
    cli = 'Con gusto le ayudamos con su solicitud. Quedamos atentos. 😊';
  } else if (r === 'actualizar') {
    // #2 Actualización de datos (cliente ya no es dueño)
    mot = (f.motivoCambio || 'ACTUALIZACIÓN DE DATOS').toUpperCase(); voz = 'ACTUALIZACIÓN DE DATOS DEL CLIENTE';
    const aPts = [pre, 'ACTUALIZACION DE DATOS', mot];
    if (f.actualizarObs) aPts.push('OBS: ' + f.actualizarObs.toUpperCase());
    nota = aPts.filter(Boolean).join(' // ');
    cli = 'Hemos actualizado sus datos. Gracias por informarnos. 😊';
  } else if (r === 'sinKm') {
    mot = 'SERVICIO NO APLICA'; voz = 'AÚN NO CUMPLE KMS';
    nota = [pre, f.kmNoAplica?`SOLO ${f.kmNoAplica} KMS`:'NO CUMPLE KM', f.reprograma?`SE REPROGRAMA PARA ${f.reprograma.toUpperCase()}`:'SE REPROGRAMA', 'SE ENVIA PLANTILLA'].filter(Boolean).join(' // ');
    cli = 'Le recordaremos cuando su vehículo se acerque al kilometraje de mantenimiento. 🚗';
  } else if (r === 'otroTaller') {
    const rz = f.razonOtro || 'PRECIO';
    mot = rz==='PRECIO'?'PRECIO ALTO':rz==='UBICACION'?'UBICACIÓN':'PREFERENCIA PROVEEDOR';
    voz = rz==='PRECIO'?'OFERTA MÁS ECONÓMICA':rz==='UBICACION'?'MAYOR COMODIDAD':'HISTÓRICO CON OTRO TALLER';
    nota = [pre, `VISITA OTRO TALLER POR ${rz}`].filter(Boolean).join(' // ');
    cli = 'Con gusto le compartimos nuestras condiciones cuando lo desee. ¡Que tenga un excelente día!';
  } else if (r === 'noContactar') {
    mot = 'CLIENTE NO INTERESADO'; voz = 'NO DESEA RECIBIR INFORMACIÓN';
    nota = [pre, 'NO VOLVER A CONTACTAR'].filter(Boolean).join(' // ');
    cli = 'Gracias por su atención. Quedamos atentos si en el futuro requiere nuestros servicios.';
  }

  // Para resultados distintos de "agenda": añadir iniciales del asesor a la nota.
  // (seg/comunica/actualizar ya incluyen su propia observación con campo dedicado;
  //  para noc/sinKm/otroTaller/noContactar se anexa la observación general si existe.)
  if (r !== 'agenda' && nota) {
    if (f.observacion && ['noc','sinKm','otroTaller','noContactar'].includes(r)) nota += ' // OBS: ' + f.observacion.toUpperCase();
    const iniR = inicialesDe(S.user);
    if (iniR) nota += ` /${iniR}`;
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
  if (r === 'agenda') {
    if (!f.kmActual)     req.push('Km actual');
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

  // Si se está gestionando un caso interno: actualizar el MISMO registro
  // (pendiente → resultado final), no crear uno nuevo.
  if (S.casoActivo) {
    const changes = {
      telefono: payload.telefono, kmActual: payload.kmActual, ciudad: payload.ciudad,
      marca: payload.marca, modelo: payload.modelo, combustion: payload.combustion,
      servicio: payload.servicio, kmServicio: payload.kmServicio, valor: payload.valor,
      resultado: payload.resultado, asesorTaller: payload.asesorTaller,
      fechaCita: payload.fechaCita, horaCita: payload.horaCita,
      novedad: payload.novedad, descNovedad: payload.descNovedad,
      weGo: payload.weGo, observacion: payload.observacion,
      notaQuiter: payload.notaQuiter, evoEstado: payload.evoEstado,
      evoCausa: payload.evoCausa, evoMotivo: payload.evoMotivo, evoVoz: payload.evoVoz
    };
    updateGestionLocal(S.casoActivo, changes, `Gestionado: ${RESULT_LABEL[payload.resultado]||payload.resultado}`);
    toast('✅ Caso gestionado');
    cancelarCasoActivo();
    setTimeout(() => { resetPanel(); renderInternos(); updateInternosBadges(); }, 600);
    return;
  }

  // Caso normal (Inbound/Outbound): se registra localmente SIEMPRE (respaldo).
  const g = pushGestionLocal(payload);
  // Si hay conexión, además se escribe en el Sheet (no bloquea la UI).
  if (getApiUrl()) {
    try {
      const r = await apiCall('guardarGestion', g, 'POST');
      toast(r && r.success ? '✅ Gestión guardada (en línea)' : '⚠️ Guardada local (servidor sin OK)');
    } catch { toast('⚠️ Guardada local (sin conexión al servidor)'); }
  } else {
    toast('✅ Gestión registrada (local)');
  }
  setTimeout(resetPanel, 600);
}

// ===== Persistencia local de gestiones (respaldo / fuente de Control de Gestión) =====
const LS_GESTIONES = 'ceta_gestiones';
function newCaseId(){ return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function getGestionesLocal(){
  let list;
  try { list = JSON.parse(localStorage.getItem(LS_GESTIONES) || '[]'); } catch { return []; }
  // Migración perezosa: garantizar id, historial y _updated en gestiones antiguas (Fase 4).
  let changed = false;
  list.forEach(g => {
    if (!g.id) { g.id = newCaseId(); changed = true; }
    if (!g._updated) { g._updated = g._ts || Date.now(); changed = true; }
    if (!Array.isArray(g.historial)) {
      g.historial = [{ ts: g._ts || Date.now(), tipo: 'Creado', autor: g.asesorCeta || '', resultado: g.resultado, nota: g.observacion || '' }];
      changed = true;
    }
  });
  if (changed) localStorage.setItem(LS_GESTIONES, JSON.stringify(list));
  return list;
}
function pushGestionLocal(payload){
  const list = getGestionesLocal();
  const now = Date.now();
  const g = {
    ...payload,
    id: newCaseId(),
    createdBy: S.user?.id ?? null,        // dueño del caso (para permisos de edición)
    createdByAlias: S.user?.alias || '',
    _ts: now, _updated: now,
    historial: [{ ts: now, tipo: 'Creado', autor: S.user?.alias || '', resultado: payload.resultado, nota: payload.observacion || '' }]
  };
  list.unshift(g);
  localStorage.setItem(LS_GESTIONES, JSON.stringify(list.slice(0, 500))); // tope de seguridad
  return g;
}
function updateGestionLocal(id, changes, nota){
  const list = getGestionesLocal();
  const i = list.findIndex(g => g.id === id);
  if (i < 0) return null;
  const g = list[i];
  const now = Date.now();
  Object.assign(g, changes);
  g._updated = now;
  g.historial = g.historial || [];
  g.historial.push({
    ts: now, tipo: 'Actualizado', autor: S.user?.alias || '',
    resultado: changes.resultado != null ? changes.resultado : g.resultado,
    nota: nota || ''
  });
  list[i] = g;
  localStorage.setItem(LS_GESTIONES, JSON.stringify(list));
  // Sincronizar con el Sheet si hay conexión (no bloquea la UI).
  if (getApiUrl()) { apiCall('actualizarGestion', g, 'POST').catch(()=>{}); }
  return g;
}

// REASIGNAR un caso a otro asesor del pool de rotación (solo coordinador).
// Cambia el dueño (asignadoId/createdBy) para que el nuevo asesor pueda editarlo,
// y deja constancia en el historial. No altera la rotación (esta es manual).
function reasignarCaso(id, nuevoAsesorId){
  if (S.user?.rol !== 'coordinador') { toast('Solo el coordinador puede reasignar'); return null; }
  const list = getGestionesLocal();
  const i = list.findIndex(g => g.id === id);
  if (i < 0) return null;
  const nuevo = getUsuarios().find(u => u.id === nuevoAsesorId);
  if (!nuevo) { toast('Asesor no válido'); return null; }
  const g = list[i];
  const prevAlias = g.asignadoAlias || g.asesorCeta || '—';
  if (g.asignadoId === nuevo.id) { toast('El caso ya está asignado a ' + nuevo.alias); return null; }
  const now = Date.now();
  g.asignadoId = nuevo.id; g.asignadoAlias = nuevo.alias;
  g.createdBy = nuevo.id; g.createdByAlias = nuevo.alias;  // el nuevo asesor pasa a poder editarlo
  g.asesorCeta = nuevo.alias;
  g._updated = now;
  g.historial = g.historial || [];
  g.historial.push({ ts: now, tipo: 'Reasignado', autor: S.user.alias, resultado: g.resultado,
    nota: `Reasignado de ${prevAlias} → ${nuevo.alias} por ${S.user.alias}` });
  list[i] = g;
  localStorage.setItem(LS_GESTIONES, JSON.stringify(list));
  if (getApiUrl()) { apiCall('actualizarGestion', g, 'POST').catch(()=>{}); }
  return g;
}

// Cuenta cuántas gestiones están vinculadas a un alias (por id o por alias).
function contarCasosDeAlias(alias){
  if (!alias) return 0;
  const a = alias.toLowerCase();
  return getGestionesLocal().filter(g =>
    (g.asesorCeta||'').toLowerCase() === a ||
    (g.asignadoAlias||'').toLowerCase() === a ||
    (g.createdByAlias||'').toLowerCase() === a
  ).length;
}
// Re-vincula las gestiones de un alias viejo al nuevo (mantiene la trazabilidad
// al cambiar el alias de un perfil). userId ayuda a desambiguar por id.
function relinkCasos(aliasViejo, aliasNuevo, userId){
  const av = (aliasViejo||'').toLowerCase();
  const list = getGestionesLocal();
  let cambiados = 0;
  list.forEach(g => {
    const matchId = userId != null && (g.createdBy === userId || g.asignadoId === userId);
    const matchAlias = (g.asesorCeta||'').toLowerCase() === av || (g.asignadoAlias||'').toLowerCase() === av || (g.createdByAlias||'').toLowerCase() === av;
    if (!matchId && !matchAlias) return;
    if ((g.asesorCeta||'').toLowerCase() === av || (matchId && g.asesorCeta)) g.asesorCeta = aliasNuevo;
    if ((g.asignadoAlias||'').toLowerCase() === av || (matchId && g.asignadoAlias)) g.asignadoAlias = aliasNuevo;
    if ((g.createdByAlias||'').toLowerCase() === av || (matchId && g.createdByAlias)) g.createdByAlias = aliasNuevo;
    if ((g.radicadoPor||'').toLowerCase() === av) g.radicadoPor = aliasNuevo;
    cambiados++;
  });
  if (cambiados) localStorage.setItem(LS_GESTIONES, JSON.stringify(list));
  return cambiados;
}

// Permiso de edición de un caso: coordinador edita todo; asesor solo el suyo; analista nunca.
function canEditCase(g){
  if (!S.user) return false;
  if (S.user.rol === 'coordinador') return true;
  if (S.user.rol === 'analista') return false;
  return g.createdBy != null && g.createdBy === S.user.id;
}

// =============================================================
//  CASOS INTERNOS — motor de asignación automática
//  Pool de rotación = los 5 asesor_cc (excluye digitales/coordinador/analista).
// =============================================================
const LS_COLAS = 'ceta_colas';

// Los 5 asesores que participan en la rotación, en orden de id.
function rotacionPool(){
  return getUsuarios().filter(u => u.rol === 'asesor_cc' && u.activo);
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
    const u = getUsuarios().find(x => x.id === dueno);
    if (u) return { asesorId: u.id, alias: u.alias, motivo: 'Propiedad (10 días)', cola };
  }
  // REGLA 1/2 — rotación por cola en bloques de 5
  const asesorId = siguienteDeCola(cola);
  const u = getUsuarios().find(x => x.id === asesorId);
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
  if (S.user.rol === 'coordinador' || S.user.rol === 'analista') return all;
  return all.filter(g => g.asignadoId === S.user.id);
}

// Precarga el Panel de Cierre con los datos de un caso interno.
// Cola B (Inspección/Especializada/Garantía) → oculta Cotización y We Go.
function precargarPanel(g){
  resetPanel();
  const setF = (k,v) => { const e = $(`[data-f="${k}"]`); if (e && v != null) e.value = v; };
  setF('nombre', g.nombre); setF('telefono', g.telefono); setF('placa', g.placa);
  setF('ciudad', g.ciudad);
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
  (DATA.usuarios||[]).forEach(usr => { if (can('config')) idx.push({t:usr.nombre, k:'Usuario', go:'config'}); });
  [['Cotizador','Panel','inbound'],['Calificador de leads','Comercial','leads']].forEach(([t,k,go]) => idx.push({t,k,go}));
  return idx;
}
function omniSearch(q){
  const res = $('#omniRes');
  q = q.trim().toLowerCase();
  if (!q) { res.classList.remove('show'); res.innerHTML=''; return; }
  const hits = buildSearchIndex().filter(i => (i.t + ' ' + (i.extra||'')).toLowerCase().includes(q)).slice(0, 12);
  if (!hits.length) { res.innerHTML = `<div class="omni-item"><span style="color:var(--tx3)">Sin resultados</span></div>`; res.classList.add('show'); return; }
  res.innerHTML = hits.map(h => `<div class="omni-item" data-go="${h.go}"><i class="fas fa-arrow-right" style="font-size:10px;color:var(--tx3)"></i>${esc(h.t)}<span class="k">${esc(h.k)}</span></div>`).join('');
  res.classList.add('show');
  $$('#omniRes .omni-item[data-go]').forEach(el => el.addEventListener('click', () => {
    goTo(el.dataset.go); res.classList.remove('show'); $('#omniInput').value='';
  }));
}

// =============================================================
//  EXPONER HANDLERS USADOS EN onclick INLINE
// =============================================================
function goToInternos(){ goTo('internos'); }
Object.assign(window, { u, pickRes, togNovedad, togWego, togAd, togChk, switchTab, cpText, cpEvo, copyMsg, downloadCard, saveGestion, closeModoTV, cancelarCasoActivo, goToInternos, onAsesorTaller, onAlertaTipo, togAlCiudad, onCotMarca, onCotCombustion, onCotModelo, togTeleAcepta });

// =============================================================
//  INIT
// =============================================================
function init(){
  renderLoginUsers();
  $('#loginBtn').addEventListener('click', doLogin);
  $('#loginPin').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
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

  // Sincronizar usuarios del Sheet ANTES de mostrar el login (perfiles compartidos).
  // Si no hay conexión, usa los locales. No bloquea más de 3s (timeout de apiCall).
  if (getApiUrl()) {
    sincronizarUsuarios().then(ok => { if (ok) renderLoginUsers(); if (restoreSession()) enterApp(); });
  } else {
    if (restoreSession()) enterApp();
  }
}
init();
