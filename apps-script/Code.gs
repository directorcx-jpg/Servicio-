/****************************************************************
 *  Code.gs — Backend Apps Script · Consola CETA Armotor
 *  ---------------------------------------------------------------
 *  Endpoints (Web App):
 *    · POST  ?action=guardarGestion       → escribe fila nueva en CETA_Gestiones_2026
 *    · POST  ?action=actualizarGestion    → actualiza fila existente (por columna id)
 *    · GET   ?action=consultarCotizador   → lee precio del Sheet cotizador (CacheService 6 min)
 *    · GET   ?action=buscarPlaca          → busca cliente por placa
 *    · GET   ?action=listarGestiones      → tabla para Control de Gestión (coordinador)
 *
 *  PUBLICACIÓN (Implementar → Nueva implementación → Aplicación web):
 *    - Ejecutar como: Yo (el editor)
 *    - Quién tiene acceso: Cualquier usuario
 *    - Copiar la URL /exec y pegarla en data.js → config.endpoints.*
 *
 *  CORS: Apps Script Web Apps responden text/JSON; el front llama con
 *  fetch sin headers personalizados para evitar el preflight.
 ****************************************************************/

// ===== CONFIGURA AQUÍ LOS IDs DE TUS SHEETS =====
var CFG = {
  // Sheet unificado de gestiones (se crea automáticamente si no existe la hoja)
  GESTIONES_SHEET_ID: 'PEGAR_ID_DEL_SHEET_CETA_Gestiones_2026',
  GESTIONES_TAB: 'Form_Responses',

  // Sheet del cotizador existente (Pablo da acceso)
  COTIZADOR_SHEET_ID: 'PEGAR_ID_DEL_SHEET_COTIZADOR',
  COTIZADOR_TAB: 'Cotizador',     // columnas: Marca | Combustion | Modelo | Km | Precio | Incluye | NoIncluye

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
    if (method === 'POST' && action === 'guardarGestion')    return json_(guardarGestion_(e));
    if (method === 'POST' && action === 'actualizarGestion') return json_(actualizarGestion_(e));
    if (action === 'consultarCotizador') return json_(consultarCotizador_(e));
    if (action === 'buscarPlaca')        return json_(buscarPlaca_(e));
    if (action === 'listarGestiones')    return json_(listarGestiones_(e));
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
//  GET /consultarCotizador?marca=KIA&combustion=Gasolina&modelo=Picanto&km=10000
// ----------------------------------------------------------------
function consultarCotizador_(e) {
  var p = e.parameter;
  var key = [p.marca, p.combustion, p.modelo, String(p.km).replace(/[.\s]/g, '')].join('-');
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cot_' + key);
  if (hit) return JSON.parse(hit);

  var sh = SpreadsheetApp.openById(CFG.COTIZADOR_SHEET_ID).getSheetByName(CFG.COTIZADOR_TAB);
  var values = sh.getDataRange().getValues();
  var res = { found: false };
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var rowKey = [r[0], r[1], r[2], String(r[3]).replace(/[.\s]/g, '')].join('-');
    if (rowKey === key) {
      res = {
        found: true,
        precio: Number(r[4]) || 0,
        incluye: String(r[5] || '').split('|').map(function (s) { return s.trim(); }).filter(String),
        noIncluye: String(r[6] || '').split('|').map(function (s) { return s.trim(); }).filter(String)
      };
      break;
    }
  }
  cache.put('cot_' + key, JSON.stringify(res), CFG.CACHE_SECONDS);
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
