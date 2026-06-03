// =============================================================
//  app.js — Consola CETA Armotor  (ES Module)
//  Lógica: autenticación + roles, navegación, panel de cierre
//  unificado con estado reactivo (S), cotizador local y salidas.
// =============================================================
import { DATA } from './data.js?v=1.4.1';

// ---------- Estado global (fuente única de verdad) ----------
const S = {
  user: null,                 // usuario logueado {id,nombre,alias,rol}
  resultado: 'agenda',
  hasNovedad: false,
  hasWG: false,
  adicionales: new Set(),
  checks: new Set(['VALIDAR CAMPAÑA ACTIVA','VALIDAR EMBELLECIMIENTO','VALIDAR ADICIONALES','VALIDAR ACCESORIOS','VALIDAR QUE MAS REQUIERE']),
  f: {},                      // campos data-f sincronizados
  // Estado de rotación de Casos Internos (REGLA 2/3). Persistido por día.
  // { fecha:'YYYY-MM-DD', A:{orden:[ids],pos:N}, B:{orden:[ids],pos:N} }
  colas: null,
  casoActivo: null            // id del caso interno precargado en el panel (si lo hay)
};
const CHECKS_DEF = ['VALIDAR CAMPAÑA ACTIVA','VALIDAR EMBELLECIMIENTO','VALIDAR ADICIONALES','VALIDAR ACCESORIOS','VALIDAR QUE MAS REQUIERE'];

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

// =============================================================
//  USUARIOS (con override de localStorage para PINs/edición)
// =============================================================
const LS_USERS = 'ceta_usuarios';
const LS_SESSION = 'ceta_session';

function getUsuarios(){
  try {
    const ov = JSON.parse(localStorage.getItem(LS_USERS) || 'null');
    if (Array.isArray(ov) && ov.length) return ov;
  } catch {}
  return DATA.usuarios.map(u => ({...u}));
}
function saveUsuarios(list){ localStorage.setItem(LS_USERS, JSON.stringify(list)); }

// =============================================================
//  AUTENTICACIÓN
// =============================================================
function renderLoginUsers(){
  const sel = $('#loginUser');
  sel.innerHTML = '';
  getUsuarios().filter(u => u.activo).forEach(u => {
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
  renderHome();
  renderContent();
  renderConfig();
  pickRes($('#resP .pill[data-r="agenda"]'));
  goTo('home');
  // Refresco de temporizadores de la bandeja (SLA 5 min) cada 30 s.
  // Solo refresca el LISTADO (renderBandeja), nunca el formulario de creación.
  if (!window._slaTimer) window._slaTimer = setInterval(() => {
    if ($('#v-internos')?.classList.contains('active')) renderBandeja();
    updateInternosBadges();
  }, 30000);
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

  const equipo = p.homeEquipo;
  const stats = equipo
    ? [['94%','Citas confirmadas','var(--ok)'],['42','Casos en gestión',''],['3','SLA en riesgo','var(--wr)'],['14','Leads nuevos','']]
    : [['—','Mis gestiones hoy',''],['—','Mis agendadas','var(--ok)'],['<2h','Meta 1er contacto',''],['20','Días propiedad lead','']];
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

    <div class="sub-l" style="margin-top:16px"><i class="fas fa-bell"></i>Bandeja de pendientes</div>
    <div id="internosBandeja"></div>`;
  el.dataset.built = '1';

  // Listeners del FORMULARIO (se enlazan una sola vez; no se vuelven a tocar).
  $('#inPlaca').addEventListener('input', renderDupAviso);
  $('#inRadicar').addEventListener('click', radicarCaso);

  renderBandeja();
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
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(g.servicio||'—')} · Cola ${esc(g.cola||'—')} · ${esc(g.ciudad||'')} · ${esc(g.grupoChat||'')}</div>
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

function crearCasoInterno(payload){
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
  // sync backend opcional
  const url = DATA.config.endpoints.guardarGestion;
  if (url) { try { fetch(url, { method:'POST', body: JSON.stringify(g) }); } catch {} }
  toast(`✅ Caso asignado a ${asign.alias} · ${asign.motivo}`);
  limpiarFormInternos();
  renderBandeja(); updateInternosBadges();   // refresca solo el listado, no el formulario
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
        return `<table class="tbl"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th style="width:24px"></th></tr></thead><tbody>
          ${fil.map(g=>`<tr class="ctrl-row" data-id="${esc(g.id)}" style="cursor:pointer">${cols.map(c=>`<td>${c.render(g)}</td>`).join('')}<td style="color:var(--tx3)"><i class="fas fa-chevron-right" style="font-size:10px"></i></td></tr>`).join('')}
        </tbody></table>`;
      })():emptyState('fa-inbox','Sin gestiones','Aún no hay gestiones registradas. Las que guardes en el panel derecho aparecerán aquí.')}
    </div>`;
  const a = $('#ctrlAsesor'); if (a) a.addEventListener('change', e => { ctrlFiltro.asesor = e.target.value; renderControl(); });
  const rr = $('#ctrlResultado'); if (rr) rr.addEventListener('change', e => { ctrlFiltro.resultado = e.target.value; renderControl(); });
  const cl = $('#ctrlClear'); if (cl) cl.addEventListener('click', () => { ctrlFiltro = { asesor:'', resultado:'' }; renderControl(); });
  const tv = $('#ctrlTV'); if (tv) tv.addEventListener('click', openModoTV);
  const cog = $('#ctrlCols'); if (cog) cog.addEventListener('click', openColsConfig);
  $$('#v-control .ctrl-row').forEach(tr => tr.addEventListener('click', () => openCaseDetail(tr.dataset.id)));
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
function renderConfig(){
  if (!can('config')) return;
  const list = getUsuarios();
  $('#usersTable').innerHTML = `
    <table class="tbl"><thead><tr><th>Usuario</th><th>Rol</th><th>PIN</th><th>Activo</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr data-id="${u.id}">
      <td><strong>${u.nombre}</strong><div style="font-size:10px;color:var(--tx3)">${u.alias}</div></td>
      <td><span class="tag ${u.rol}">${rolLabel(u.rol)}</span></td>
      <td><input class="cfg-pin" value="${u.pin}" maxlength="4" inputmode="numeric" style="width:64px;font-family:var(--fm);text-align:center;border:1px solid var(--bd);background:var(--bgs);color:var(--tx);padding:5px;border-radius:5px"></td>
      <td><label class="tog"><span class="tog-sw cfg-act ${u.activo?'on':''}"></span></label></td>
      <td><button class="btn btn-ok cfg-save"><i class="fas fa-floppy-disk"></i> Guardar</button></td>
    </tr>`).join('')}
    </tbody></table>`;
  $$('#usersTable .cfg-act').forEach(sw => sw.addEventListener('click', () => sw.classList.toggle('on')));
  $$('#usersTable .cfg-save').forEach(btn => btn.addEventListener('click', e => {
    const tr = e.target.closest('tr'); const id = +tr.dataset.id;
    const pin = tr.querySelector('.cfg-pin').value.trim();
    const activo = tr.querySelector('.cfg-act').classList.contains('on');
    if (!/^\d{4}$/.test(pin)) { toast('El PIN debe ser de 4 dígitos'); return; }
    const list2 = getUsuarios().map(u => u.id===id ? {...u, pin, activo} : u);
    saveUsuarios(list2); renderConfig(); toast('Usuario actualizado ✓');
  }));
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
}

// =============================================================
//  PANEL — selección de resultado y toggles
// =============================================================
function pickRes(b){
  if (!b) return;
  $$('#resP .pill').forEach(p => p.classList.remove('on'));
  b.classList.add('on'); S.resultado = b.dataset.r;
  ['noc-f','sinKm-f','otroTaller-f'].forEach(id => $('#'+id).classList.add('hidden'));
  const agSec = ['sCotiz','sNovedad','sWego','sAdic'];
  if (S.resultado === 'agenda') {
    agSec.forEach(s => $('#'+s).classList.remove('hidden'));
  } else {
    agSec.forEach(s => $('#'+s).classList.add('hidden'));
    if (S.resultado === 'noc')        $('#noc-f').classList.remove('hidden');
    if (S.resultado === 'sinKm')      $('#sinKm-f').classList.remove('hidden');
    if (S.resultado === 'otroTaller') $('#otroTaller-f').classList.remove('hidden');
    // En "seguimiento" mostramos también Novedad (1+3+6)
    if (S.resultado === 'seg')        $('#sNovedad').classList.remove('hidden');
  }
  // Caso interno Cola B (no factura): Cotización y We Go nunca aplican.
  if (S.casoActivo) {
    const ca = getGestionesLocal().find(x => x.id === S.casoActivo);
    if (ca && colaDeServicio(ca.servicio) === 'B') {
      $('#sCotiz').classList.add('hidden'); $('#sWego').classList.add('hidden');
    }
  }
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
}

// =============================================================
//  COTIZADOR (desde DATA.cotizador.local + descuento)
// =============================================================
function fmtCOP(n){ return '$ ' + Math.round(n).toLocaleString('es-CO'); }
function kmKey(km){ return (km||'').replace(/[.\s]/g,''); }

function computeQuote(){
  const f = S.f;
  const key = `${f.marca}-${f.combustion}-${f.modelo}-${kmKey(f.kmServicio)}`;
  const item = DATA.cotizador.local[key];
  if (!item) {
    return { found:false, precio:null, texto:'Consultar', incluye:DATA.cotizador.incluyeBase,
             noIncluye: f.combustion==='Eléctrico' ? DATA.cotizador.noIncluyeEV : DATA.cotizador.noIncluyeBase };
  }
  const desc = parseInt(f.descuento||'0',10) || 0;
  const precio = item.precio * (1 - desc/100);
  return { found:true, precio, texto:fmtCOP(precio),
           incluye:item.incluye||DATA.cotizador.incluyeBase, noIncluye:item.noIncluye||DATA.cotizador.noIncluyeBase };
}

// =============================================================
//  MASTER UPDATE — regenera salidas desde S
// =============================================================
function u(){
  syncState();
  const f = S.f, r = S.resultado;
  const pla = (f.placa||'').toUpperCase(), tel = f.telefono||'';
  const pre = [pla, tel].filter(Boolean).join(' // ');
  const signos = DATA.tipificador.servicioSigno;
  let nota='', est='', cau='', mot='', voz='', cli='';

  const q = computeQuote();
  $('#pPrecio').textContent = q.texto === 'Consultar' ? 'Consultar' : q.texto;

  const evo = DATA.tipificador.resultadoEvo[r] || {};
  est = evo.estado || ''; cau = evo.causa || '';

  if (r === 'agenda') {
    const serv = (f.servicio||'Mantenimiento').toUpperCase();
    const signo = signos[serv] ? ' ' + signos[serv] : '';
    mot = serv === 'MANTENIMIENTO' ? 'CAMBIO DE ACEITE' : serv;
    voz = (S.hasNovedad && f.novedad) ? f.novedad.toUpperCase() : 'MANTENIMIENTO PREVENTIVO';
    const valor = q.found ? q.texto.replace('$ ','') : 'CONSULTAR';
    const pts = [pre, f.kmActual?`${f.kmActual} KM`:'', `${serv} ${f.kmServicio||'10.000'}KM $ ${valor} IVA INCLUIDO`];
    if (S.hasNovedad && f.novedad) pts.push(f.novedad.toUpperCase());
    S.checks.forEach(c => pts.push(c));
    if (S.adicionales.has('telemetria')) pts.push('VALIDAR TELEMETRIA');
    if (S.adicionales.has('accesorios') && f.accesorios) pts.push('ACCESORIOS: ' + f.accesorios.toUpperCase());
    if (S.hasWG) pts.push('APLICA WE GO');
    if (f.asesorTaller) pts.push('RECIBE: ' + f.asesorTaller.toUpperCase());
    nota = pts.filter(Boolean).join(' // ') + ` // CALL CENTER${signo}`;

    const svCli = {Mantenimiento:'el mantenimiento',Revisión:'la revisión',Garantía:'la atención de garantía',Inspección:'la inspección',Especializada:'el diagnóstico'}[f.servicio] || 'el servicio';
    const lineas = [
      'Le confirmamos lo que realizaremos en su cita:', '',
      `🔧 ${cap(svCli)} de los ${f.kmServicio||'—'} km`,
      `💰 Valor: ${q.texto} (IVA incluido)`
    ];
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
    nota = [pre, 'SE REPROGRAMA CONTACTO'].filter(Boolean).join(' // ');
    cli = 'Quedamos en contacto. Cuando lo prefiera retomamos su solicitud. 😊';
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
  $('#tSrv').textContent = `${f.servicio||'Mantenimiento'} ${f.kmServicio||'—'} km`;
  $('#tPr').textContent  = q.texto;
  $('#tFe').textContent  = new Date().toLocaleDateString('es-CO');
  $('#tInc').innerHTML = q.incluye.map(x => `<li>• ${x}</li>`).join('');
  $('#tExc').innerHTML = q.noIncluye.map(x => `<li>• ${x}</li>`).join('');
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
    servicio:f.servicio||'', kmServicio:f.kmServicio||'', marca:f.marca||'',
    combustion:f.combustion||'', valor: q.found ? Math.round(q.precio) : '',
    alineacion:f.alineacion||'', descuento:f.descuento||'', embellecimiento:f.embellecimiento||'',
    novedad: S.hasNovedad ? 'Sí' : 'No', descNovedad:f.novedad||'',
    weGo: S.hasWG ? 'Sí' : 'No', wgFecha:f.wgFecha||'', wgHora:f.wgHora||'',
    wgDireccion:f.wgDireccion||'', wgQuien:f.wgQuien||'', wgTrayectos:f.wgTrayectos||'',
    telemetria: S.adicionales.has('telemetria') ? 'Sí':'No',
    accesoriosOf: S.adicionales.has('accesorios') ? 'Sí':'No', cualesAccesorios:f.accesorios||'',
    srvAdicional:f.srvAdicional||'',
    resultado:S.resultado, asesorTaller:f.asesorTaller||'', fechaCita:f.fechaCita||'', horaCita:f.horaCita||'',
    observacion:f.observacion||'',
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

  // Caso normal (Inbound/Outbound): se registra localmente.
  pushGestionLocal(payload);
  const url = DATA.config.endpoints.guardarGestion;
  if (url) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), DATA.config.apiTimeoutMs);
      await fetch(url, { method:'POST', body:JSON.stringify(payload), signal:ctrl.signal });
      clearTimeout(to);
      toast('✅ Gestión guardada');
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
  // Sincronizar con backend si está configurado (no bloquea la UI).
  const url = DATA.config.endpoints.actualizarGestion;
  if (url) {
    try { fetch(url, { method:'POST', body: JSON.stringify(g) }); } catch {}
  }
  return g;
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
  setF('ciudad', g.ciudad); setF('servicio', g.servicio);
  setF('origen', 'Base');   // origen del contacto en el panel
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
  // restablecer km servicio a 10.000 (segunda opción)
  const kmSel = $('[data-f="kmServicio"]'); if (kmSel) kmSel.value = '10.000';
  S.hasNovedad=false; S.hasWG=false; S.adicionales.clear();
  S.checks = new Set(CHECKS_DEF);
  $('#novSw').classList.remove('warn'); $('#wgSw').classList.remove('on');
  $('#novedadF').classList.add('hidden'); $('#wgF').classList.add('hidden'); $('#accF').classList.add('hidden');
  $('#wegoOk').classList.remove('hidden'); $('#wegoBlocked').classList.add('hidden');
  $$('.pill[data-ad]').forEach(p => p.classList.remove('on'));
  $$('.pill[data-chk]').forEach(p => p.classList.toggle('on', S.checks.has(p.dataset.chk)));
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
Object.assign(window, { u, pickRes, togNovedad, togWego, togAd, togChk, switchTab, cpText, cpEvo, copyMsg, downloadCard, saveGestion, closeModoTV, cancelarCasoActivo, goToInternos });

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
  $('#ftMode').textContent = DATA.config.endpoints.guardarGestion ? 'En línea' : 'Local';

  if (restoreSession()) enterApp();
}
init();
