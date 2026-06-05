/****************************************************************
 *  Code.gs — Backend Apps Script · Consola CETA Armotor
 *  ---------------------------------------------------------------
 *  Endpoints (Web App):
 *    · GET   ?action=ping                  → prueba de conexión (lo usa Configuración)
 *    · GET   ?action=consultarCotizador    → lee "Kits Kia" en vivo (CacheService 6 min)
 *    · POST  ?action=guardarGestion        → escribe fila nueva en CETA_Gestiones_2026
 *    · POST  ?action=actualizarGestion     → actualiza fila existente (por columna id)
 *    · GET   ?action=buscarPlaca           → busca cliente por placa
 *    · GET   ?action=listarGestiones       → tabla para Control de Gestión (coordinador)
 *    · GET   ?action=listarUsuarios        → lista de perfiles compartida del equipo
 *    · POST  ?action=guardarUsuarios       → reemplaza la lista de perfiles (sincroniza dispositivos)
 *
 *  ───────────────────────────────────────────────────────────────
 *  PASOS PARA PUBLICAR (Pablo):
 *  1) Crea una hoja nueva en Drive llamada "CETA_Gestiones_2026".
 *     Copia su ID (el código largo de la URL entre /d/ y /edit) y pégalo
 *     abajo en CFG.GESTIONES_SHEET_ID.
 *  2) Da acceso de lectura al libro del cotizador (ya viene el ID 1B0vYkj…).
 *  3) Pega TODO este archivo en script.google.com (Nuevo proyecto).
 *  4) Implementar → Nueva implementación → tipo "Aplicación web":
 *        - Ejecutar como: Yo (tu cuenta)
 *        - Quién tiene acceso: Cualquier usuario
 *  5) Copia la URL que termina en /exec.
 *  6) En la Consola CETA: Configuración → "Conexión Apps Script" →
 *     pega la URL y pulsa "Probar conexión". Si responde OK, ya quedó.
 *  ───────────────────────────────────────────────────────────────
 *
 *  CORS: Apps Script Web Apps responden text/JSON; el front llama con
 *  fetch sin headers personalizados para evitar el preflight.
 ****************************************************************/

// ===== CONFIGURA AQUÍ LOS IDs DE TUS SHEETS =====
var CFG = {
  // Sheet unificado de gestiones (se crea automáticamente si no existe la hoja)
  GESTIONES_SHEET_ID: 'PEGAR_ID_DEL_SHEET_CETA_Gestiones_2026',
  GESTIONES_TAB: 'Form_Responses',

  // Sheet del cotizador KIA (Módulo 3 — pestaña real "Kits Kia")
  COTIZADOR_SHEET_ID: '1B0vYkjXKJ1BDv0O9SbVKbzkPZidpUrqlY2XKs7mCl3c',
  COTIZADOR_TAB: 'Kits Kia',      // lectura por NOMBRE de encabezado (robusto a reordenamiento)

  // Sheet/base de clientes para buscar por placa
  CLIENTES_SHEET_ID: 'PEGAR_ID_DEL_SHEET_CLIENTES',
  CLIENTES_TAB: 'Clientes',       // columnas: Placa | Nombre | Telefono | Modelo

  CACHE_SECONDS: 360              // 6 minutos
};

// Orden EXACTO de las 40 columnas del Sheet unificado (spec-panel-cierre-unificado.md)
var COLS = [
  'marcaTemporal','asesorCeta','nombre','telefono','placa','modelo','kmActual','ciudad','fechaNac','origen',
  'servicio','kmServicio','marca','combustion','valor','alineacion','descuento','embellecimiento',
  'novedad','descNovedad','weGo','wgFecha','wgHora','wgDireccion','wgQuien','wgTrayectos',
  'telemetria','accesoriosOf','cualesAccesorios','srvAdicional',
  'resultado','asesorTaller','fechaCita','horaCita','observacion',
  'notaQuiter','evoEstado','evoCausa','evoMotivo','evoVoz',
  // columnas extra (41+) para edición/trazabilidad y Casos Internos — no forman parte de las 40 del spec
  'id','createdByAlias','historialJSON',
  'cola','asignadoAlias','asignMotivo','grupoChat','notaSolicitante','radicadoPor','tipoRadicacion'
];
var HEADERS = [
  'Marca temporal','Asesor CETA','Nombre cliente','Teléfono','Placa','Modelo','Km actual','Ciudad','Fecha nacimiento','Origen',
  'Tipo servicio','Km servicio','Marca vehículo','Combustión','Valor cotizado','Alineación','Descuento','Embellecimiento',
  'Novedad reportada','Descripción novedad','We Go','Fecha We Go','Hora We Go','Dirección We Go','Quién recoge','Trayectos',
  'Telemetría ofrecida','Accesorios ofrecidos','Cuáles accesorios','Servicios adicionales',
  'Resultado','Asesor servicio taller','Fecha cita','Hora cita','Observación',
  'Nota Quiter/iVuo','Evo Estado','Evo Causa','Evo Motivo','Evo Voz cliente',
  'ID','Creado por','Historial (JSON)',
  'Cola','Asignado a','Motivo asignación','Grupo chat','Nota solicitante','Radicado por','Tipo radicación'
];

// ----------------------------------------------------------------
//  ROUTER
// ----------------------------------------------------------------
function doGet(e)  { return route_(e, 'GET'); }
function doPost(e) { return route_(e, 'POST'); }

function route_(e, method) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'ping') return json_({ success: true, app: 'CETA', version: '1.0', hora: new Date().toISOString() });
    if (method === 'POST' && action === 'guardarGestion')    return json_(guardarGestion_(e));
    if (method === 'POST' && action === 'actualizarGestion') return json_(actualizarGestion_(e));
    if (action === 'consultarCotizador') return json_(consultarCotizador_(e));
    if (action === 'buscarPlaca')        return json_(buscarPlaca_(e));
    if (action === 'listarGestiones')    return json_(listarGestiones_(e));
    if (action === 'listarUsuarios')     return json_(listarUsuarios_(e));
    if (method === 'POST' && action === 'guardarUsuarios') return json_(guardarUsuarios_(e));
    return json_({ success: false, error: 'Acción no reconocida: ' + action });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------
//  POST /guardarGestion
// ----------------------------------------------------------------
function guardarGestion_(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById(CFG.GESTIONES_SHEET_ID);
  var sh = ss.getSheetByName(CFG.GESTIONES_TAB);
  if (!sh) {
    sh = ss.insertSheet(CFG.GESTIONES_TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  if (!data.marcaTemporal) {
    data.marcaTemporal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  }
  var row = rowFromData_(data);
  sh.appendRow(row);
  return { success: true, row: sh.getLastRow(), id: data.id || '' };
}

// Convierte el objeto del front en el arreglo de columnas (incluye id/historial).
function rowFromData_(data) {
  return COLS.map(function (k) {
    if (k === 'historialJSON') return JSON.stringify(data.historial || []);
    var v = data[k];
    if (Array.isArray(v)) return v.join(' // ');
    return (v == null) ? '' : v;
  });
}

// ----------------------------------------------------------------
//  POST /actualizarGestion  (busca por columna 'id' y reescribe la fila)
// ----------------------------------------------------------------
function actualizarGestion_(e) {
  var data = JSON.parse(e.postData.contents);
  if (!data.id) return { success: false, error: 'Falta id' };
  var sh = SpreadsheetApp.openById(CFG.GESTIONES_SHEET_ID).getSheetByName(CFG.GESTIONES_TAB);
  if (!sh || sh.getLastRow() < 2) return { success: false, error: 'Sin datos' };
  var idCol = COLS.indexOf('id'); // 0-based
  var values = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id)) {
      var rowNum = i + 2;
      sh.getRange(rowNum, 1, 1, COLS.length).setValues([rowFromData_(data)]);
      return { success: true, row: rowNum, id: data.id };
    }
  }
  return { success: false, error: 'ID no encontrado: ' + data.id };
}

// ----------------------------------------------------------------
//  GET /consultarCotizador  → lee la pestaña "Kits Kia" en vivo (Módulo 3)
//  Devuelve { precios: [...], combustion: {...}, combos: [...] } para que el
//  frontend arme la cascada igual que con el seed. CacheService 6 min.
// ----------------------------------------------------------------
function consultarCotizador_(e) {
  var cache = CacheService.getScriptCache();
  var cacheado = cache.get('cotizador_kia');
  if (cacheado) return JSON.parse(cacheado);

  var hoja = SpreadsheetApp.openById(CFG.COTIZADOR_SHEET_ID).getSheetByName(CFG.COTIZADOR_TAB);
  var datos = hoja.getDataRange().getValues();
  var enc = datos.shift().map(function (h) { return String(h).trim(); });

  // Ubicar columnas por NOMBRE (no por posición)
  var col = function (n) { return enc.findIndex(function (h) { return h.toLowerCase() === n.toLowerCase(); }); };
  var cMod = col('Modelo'), cKit = col('Código.kit'), cDesc = col('Descripción'),
      cMO = col('MO+Impto'), cRec = col('Rec+Impto'), cTot = col('Tot+Impto');

  var esBasura = function (m) { return /no coincide|cambio aceite|^revisi[oó]n (par|impar)/i.test(m); };
  var normServ = function (d) {
    return String(d).replace(/rv\.?/ig, 'RV.').replace(/\bkm\b/ig, 'KM').replace(/\s+/g, ' ').trim();
  };

  // precios agrupados por modelo: { modelo: [[desc, MO, Rec, kit], ...] }
  var precios = {};
  var vistos = {};
  datos.forEach(function (f) {
    var modelo = String(f[cMod] || '').trim();
    var total = Number(f[cTot]) || 0;
    if (!modelo || esBasura(modelo) || total <= 0) return;
    var servicio = normServ(f[cDesc]);
    var llave = modelo + '|' + servicio;
    if (vistos[llave]) return;
    vistos[llave] = true;
    if (!precios[modelo]) precios[modelo] = [];
    precios[modelo].push([servicio, Number(f[cMO]) || 0, Number(f[cRec]) || 0, String(f[cKit] || '').trim()]);
  });

  var res = { marca: 'KIA', precios: precios, generado: new Date().toISOString() };
  cache.put('cotizador_kia', JSON.stringify(res), CFG.CACHE_SECONDS);
  return res;
}

// ----------------------------------------------------------------
//  GET /buscarPlaca?placa=ABC123
// ----------------------------------------------------------------
function buscarPlaca_(e) {
  var placa = String(e.parameter.placa || '').toUpperCase().replace(/\s/g, '');
  if (!placa) return { found: false };
  var sh = SpreadsheetApp.openById(CFG.CLIENTES_SHEET_ID).getSheetByName(CFG.CLIENTES_TAB);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase().replace(/\s/g, '') === placa) {
      return { found: true, placa: placa, nombre: values[i][1] || '', telefono: values[i][2] || '', modelo: values[i][3] || '' };
    }
  }
  return { found: false };
}

// ----------------------------------------------------------------
//  GET /listarGestiones?desde=YYYY-MM-DD   (para Control de Gestión)
// ----------------------------------------------------------------
function listarGestiones_(e) {
  var sh = SpreadsheetApp.openById(CFG.GESTIONES_SHEET_ID).getSheetByName(CFG.GESTIONES_TAB);
  if (!sh || sh.getLastRow() < 2) return { success: true, rows: [] };
  var values = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var o = {};
    for (var c = 0; c < COLS.length; c++) o[COLS[c]] = values[i][c];
    rows.push(o);
  }
  return { success: true, rows: rows };
}

// ----------------------------------------------------------------
//  USUARIOS — lista compartida del equipo (pestaña "Usuarios", col A = JSON)
//  Permite que los perfiles que el coordinador crea/edita se vean en TODOS
//  los dispositivos. guardarUsuarios reemplaza la lista completa.
// ----------------------------------------------------------------
var USUARIOS_TAB = 'Usuarios';

function listarUsuarios_(e) {
  var sh = SpreadsheetApp.openById(CFG.GESTIONES_SHEET_ID).getSheetByName(USUARIOS_TAB);
  if (!sh || sh.getLastRow() < 1) return { success: true, usuarios: [] };
  var celda = sh.getRange(1, 1).getValue();
  if (!celda) return { success: true, usuarios: [] };
  try { return { success: true, usuarios: JSON.parse(celda) }; }
  catch (err) { return { success: true, usuarios: [] }; }
}

function guardarUsuarios_(e) {
  var data = JSON.parse(e.postData.contents);   // { usuarios: [...] }
  var lista = data.usuarios || [];
  var ss = SpreadsheetApp.openById(CFG.GESTIONES_SHEET_ID);
  var sh = ss.getSheetByName(USUARIOS_TAB);
  if (!sh) sh = ss.insertSheet(USUARIOS_TAB);
  sh.getRange(1, 1).setValue(JSON.stringify(lista));
  return { success: true, total: lista.length };
}
