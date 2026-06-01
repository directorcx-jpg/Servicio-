// =============================================================
//  app.js — Consola CETA Armotor  (ES Module)
//  Lógica: autenticación + roles, navegación, panel de cierre
//  unificado con estado reactivo (S), cotizador local y salidas.
// =============================================================
import { DATA } from './data.js';

// ---------- Estado global (fuente única de verdad) ----------
const S = {
  user: null,                 // usuario logueado {id,nombre,alias,rol}
  resultado: 'agenda',
  hasNovedad: false,
  hasWG: false,
  adicionales: new Set(),
  checks: new Set(['VALIDAR CAMPAÑA ACTIVA','VALIDAR EMBELLECIMIENTO','VALIDAR ADICIONALES','VALIDAR ACCESORIOS','VALIDAR QUE MAS REQUIERE']),
  f: {}                       // campos data-f sincronizados
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
  renderInbound();
  renderConfig();
  renderPlaceholders();
  pickRes($('#resP .pill[data-r="agenda"]'));
  goTo('home');
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
//  INBOUND (fichas Validar/Decir/Hacer/Escalar desde DATA)
// =============================================================
function renderInbound(){
  const wrap = $('#inboundWrap');
  const pasos = DATA.inbound || [];
  if (!pasos.length) { wrap.innerHTML = emptyState('fa-phone-volume','Inbound Posventa','Los 10 pasos se cargan en Fase 3.'); return; }
  const ps = pasos[0];
  wrap.innerHTML = `
    <h1 class="ft-title">Flujo Inbound · Paso ${ps.paso} — ${ps.titulo}</h1>
    <div class="badges">${ps.marca?`<span class="badge kia">${ps.marca}</span>`:''}<span class="badge voz"><i class="fas fa-phone"></i> Voz</span><span class="badge vig"><i class="fas fa-circle" style="font-size:5px"></i> ${ps.tiempo||''}</span></div>
    <div class="fb"><div class="bt val"><span class="n">1</span>Qué validar</div><ul class="cl">${(ps.validar||[]).map(x=>`<li><span class="ck"></span>${x}</li>`).join('')}</ul></div>
    <div class="fb"><div class="bt say"><span class="n">2</span>Qué decir al cliente</div><div class="sp">${ps.decir||''}</div>${(ps.tips||[]).map(t=>`<div class="al in"><i class="fas fa-lightbulb"></i><div><strong>Tip:</strong> ${t}</div></div>`).join('')}</div>
    <div class="fb"><div class="bt do"><span class="n">3</span>Qué hacer después</div><ul class="cl">${(ps.hacer||[]).map(x=>`<li><span class="ck"></span>${x}</li>`).join('')}</ul></div>
    ${ps.escalar?`<div class="fb"><div class="bt esc"><span class="n">4</span>Cuándo escalar</div><div class="al wr"><i class="fas fa-triangle-exclamation"></i><div>${ps.escalar}</div></div></div>`:''}
    <div class="al in" style="margin-top:14px"><i class="fas fa-circle-info"></i><div>Muestra representativa. La navegación completa de 10 pasos (← →) llega en Fase 3.</div></div>`;
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
function renderPlaceholders(){
  const ph = {
    outbound:['fa-arrow-up-from-bracket','Outbound','4 guiones (Advance, Recuperación, Seguridad, Total Confianza) — Fase 3.'],
    leads:['fa-bullseye','Lead Comercial','Calificador P1–P4 integrado al guion — Fase 3.'],
    whatsapp:['fab fa-whatsapp','Plantillas WhatsApp','25 plantillas en 8 categorías — Fase 3.'],
    internos:['fa-inbox','Casos Internos CETA','Radicación y asignación — Fase 5.'],
    control:['fa-table-columns','Control de Gestión','Tabla, filtros y Modo TV — Fase 4 (requiere backend).'],
    productos:['fa-book','Productos y Servicios','Telemetría, We Go, Garantías — Fase 3.'],
    contactos:['fa-address-book','Contactos y Sedes','70 corporativos + IVR, buscables — Fase 3.'],
    manuales:['fa-wrench','Manuales de Mantenimiento','Consulta por marca/modelo/km — Fase 3.'],
    campanias:['fa-bullhorn','Campañas Activas','Seguridad KIA · Total Confianza — Fase 3.'],
    vip:['fa-crown','Clientes VIP','Lista prioritaria con badge dorado — Fase 3.']
  };
  Object.entries(ph).forEach(([k,[ic,t,m]]) => {
    const el = $('#v-'+k); if (el && !el.innerHTML.trim()) el.innerHTML = emptyState(ic.replace('fab ','').replace('fas ',''), t, m);
  });
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
  const url = DATA.config.endpoints.guardarGestion;
  if (url) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), DATA.config.apiTimeoutMs);
      await fetch(url, { method:'POST', body:JSON.stringify(payload), signal:ctrl.signal });
      clearTimeout(to);
      toast('✅ Gestión guardada');
    } catch { toast('⚠️ Guardado local (sin conexión al servidor)'); }
  } else {
    console.log('[CETA] Gestión (local, sin backend):', payload);
    toast('✅ Gestión registrada (local)');
  }
  setTimeout(resetPanel, 600);
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
  (DATA.inbound||[]).forEach(p => idx.push({t:`Inbound · ${p.titulo}`, k:'Guion', go:'inbound'}));
  (DATA.sedes||[]).forEach(s => idx.push({t:`Sede ${s.nombre}`, k:'Sede', go:'contactos'}));
  (DATA.campanias||[]).forEach(c => idx.push({t:c.titulo, k:'Campaña', go:'campanias'}));
  (DATA.usuarios||[]).forEach(usr => { if (can('config')) idx.push({t:usr.nombre, k:'Usuario', go:'config'}); });
  [['Cotizador','Panel','inbound'],['Plantillas WhatsApp','Atención','whatsapp'],['Clientes VIP','BdC','vip'],['Telemetría','Producto','productos'],['We Go','Producto','productos']]
    .forEach(([t,k,go]) => idx.push({t,k,go}));
  return idx;
}
function omniSearch(q){
  const res = $('#omniRes');
  q = q.trim().toLowerCase();
  if (!q) { res.classList.remove('show'); res.innerHTML=''; return; }
  const hits = buildSearchIndex().filter(i => i.t.toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) { res.innerHTML = `<div class="omni-item"><span style="color:var(--tx3)">Sin resultados</span></div>`; res.classList.add('show'); return; }
  res.innerHTML = hits.map(h => `<div class="omni-item" data-go="${h.go}"><i class="fas fa-arrow-right" style="font-size:10px;color:var(--tx3)"></i>${h.t}<span class="k">${h.k}</span></div>`).join('');
  res.classList.add('show');
  $$('#omniRes .omni-item[data-go]').forEach(el => el.addEventListener('click', () => {
    goTo(el.dataset.go); res.classList.remove('show'); $('#omniInput').value='';
  }));
}

// =============================================================
//  EXPONER HANDLERS USADOS EN onclick INLINE
// =============================================================
Object.assign(window, { u, pickRes, togNovedad, togWego, togAd, togChk, switchTab, cpText, cpEvo, copyMsg, downloadCard, saveGestion });

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
  $('#ftVer').textContent = 'v' + DATA.config.version;
  $('#ftMode').textContent = DATA.config.endpoints.guardarGestion ? 'En línea' : 'Local';

  if (restoreSession()) enterApp();
}
init();
