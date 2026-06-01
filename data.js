// =============================================================
//  data.js — Consola CETA Armotor
//  ES Module. Exporta TODO el contenido como un único objeto DATA.
//  Fase 1 + Fase 2: usuarios/roles, cotizador local, tipificador.
//  El contenido de guiones/BdC (Fase 3) se carga desde los .md de /docs.
// =============================================================

export const DATA = {

  // ===== CONFIGURACIÓN GENERAL =====
  config: {
    version: "1.0.0",
    fecha: "Mayo 2026",
    owner: "Pablo Andrey Rincón",
    // Backend transaccional — pendiente de deploy. Mientras esté vacío,
    // el panel opera 100% local (no escribe a Google Sheet todavía).
    endpoints: {
      guardarGestion: "",      // POST  → CETA_Gestiones_2026
      consultarCotizador: "",  // GET   → Sheet cotizador
      buscarPlaca: ""          // GET   → base de clientes
    },
    apiTimeoutMs: 3000
  },

  // ===== USUARIOS Y ROLES =====
  // ⚠️ PINs TEMPORALES sembrados para poder probar el login HOY.
  //    Pablo debe cambiarlos desde Configuración → Usuarios.
  //    Roles válidos: coordinador | analista | asesor_cc | asesor_digital
  usuarios: [
    { id: 1, nombre: "Pablo Andrey Rincón",  alias: "Pablo R.",  rol: "coordinador",     pin: "2468", activo: true },
    { id: 2, nombre: "Johana Betancurth",    alias: "Johana",    rol: "asesor_cc",       pin: "1102", activo: true },
    { id: 3, nombre: "Juan Diego Villa",     alias: "Juan Villa",rol: "asesor_cc",       pin: "1103", activo: true },
    { id: 4, nombre: "Karen Julieth Corchuelo", alias: "Karen",  rol: "asesor_cc",       pin: "1104", activo: true },
    { id: 5, nombre: "Alejandra Tabares",    alias: "Aleja",     rol: "asesor_cc",       pin: "1105", activo: true },
    { id: 6, nombre: "Julio Pineda",         alias: "Julio",     rol: "asesor_cc",       pin: "1106", activo: true },
    { id: 7, nombre: "Paula Andrea Arévalo", alias: "Paula",     rol: "asesor_digital",  pin: "1107", activo: true },
    { id: 8, nombre: "Natalia Vargas",       alias: "Nata",      rol: "asesor_digital",  pin: "1108", activo: true },
    { id: 9, nombre: "Analista de Datos",    alias: "Analista",  rol: "analista",        pin: "1109", activo: true }
  ],

  // Matriz de permisos por rol (consumida por can() en app.js)
  permisos: {
    coordinador:    { homeEquipo: true,  registrar: true,  verCasos: "todos",   controlGestion: true,  modoTV: true,  reasignar: true,  editarContenido: true,  config: true,  internosAsignar: true,  exportar: true },
    analista:       { homeEquipo: true,  registrar: false, verCasos: "todos",   controlGestion: true,  modoTV: true,  reasignar: false, editarContenido: false, config: false, internosAsignar: false, exportar: true },
    asesor_cc:      { homeEquipo: false, registrar: true,  verCasos: "propios", controlGestion: "propios", modoTV: false, reasignar: false, editarContenido: false, config: false, internosAsignar: "ver", exportar: false },
    asesor_digital: { homeEquipo: false, registrar: true,  verCasos: "propios", controlGestion: "propios", modoTV: false, reasignar: false, editarContenido: false, config: false, internosAsignar: false, exportar: false }
  },

  // ===== COTIZADOR (fallback local) =====
  // Clave: "MARCA-COMBUSTION-MODELO-KM".  Si no hay match → "Consultar".
  // ⚠️ Solo Picanto 10K está confirmado con datos reales del brief.
  //    Las demás combinaciones se completan en Fase 3 desde los manuales.
  cotizador: {
    incluyeBase: [
      "Cambio de aceite y filtro de motor",
      "Diagnóstico eléctrico KDS 2.0",
      "Inspección multipunto 30+",
      "Alineación",
      "Balanceo",
      "Rotación de llantas",
      "Revisión de frenos, suspensión y dirección",
      "Prueba de ruta",
      "Lavado exterior + aspirado"
    ],
    noIncluyeBase: [
      "Filtro de aire motor",
      "Filtro de aire acondicionado",
      "Plumillas"
    ],
    // Para vehículo eléctrico (EV): no incluye plumillas, sí los dos filtros
    noIncluyeEV: [
      "Plumillas"
    ],
    local: {
      "KIA-Gasolina-Picanto-10000": {
        precio: 1068978,
        incluye: [
          "Cambio de aceite y filtro de motor",
          "Diagnóstico KDS 2.0",
          "Alineación, balanceo y rotación de llantas",
          "Inspección multipunto 30+",
          "Revisión de frenos, suspensión y dirección",
          "Prueba de ruta",
          "Lavado exterior + aspirado"
        ],
        noIncluye: ["Filtro de aire motor", "Filtro de aire A/C", "Plumillas"]
      }
      // ... resto de modelos × km × precio (Fase 3, desde los 5 PDFs de manuales)
    }
  },

  // ===== TIPIFICADOR — Mapeo a Evolution =====
  tipificador: {
    // Signo que se anexa al final de la nota Quiter según el servicio
    servicioSigno: {
      "MANTENIMIENTO": "++",
      "REVISIÓN": "*",
      "GARANTÍA": "??",
      "INSPECCIÓN": "",
      "ESPECIALIZADA": "??"
    },
    // Estado/Causa por resultado del panel (los códigos coinciden con S.resultado)
    resultadoEvo: {
      "agenda":      { estado: "CONTACTO",    causa: "AGENDAMIENTO EXITOSO" },
      "seg":         { estado: "CONTACTO",    causa: "VOLVER A LLAMAR" },
      "noc":         { estado: "NO CONTACTO", causa: "NO CONTESTA" },
      "sinKm":       { estado: "CONTACTO",    causa: "NO TIENE KILOMETRAJE" },
      "otroTaller":  { estado: "CONTACTO",    causa: "VISITA OTRO TALLER" },
      "noContactar": { estado: "CONTACTO",    causa: "NO VOLVER A CONTACTAR" }
    }
  },

  // ===== SEDES (resumen; detalle completo en Fase 3) =====
  sedes: [
    {
      nombre: "Pereira", marcas: ["KIA","Honda","FAW","Usados"],
      direccion: "Av. 30 de Agosto No. 93-41",
      maps: "https://maps.app.goo.gl/Npw2My28NEPERB1SA",
      horarioTaller: "L-V 7:30am-5:30pm | Sáb 9:00am-1:00pm",
      horarioVitrina: "L-V 8:00am-6:00pm | Sáb 9:00am-1:00pm"
    },
    { nombre: "Armenia",            marcas: ["KIA","Honda","FAW","Usados"], direccion: "", horarioTaller: "", horarioVitrina: "" },
    { nombre: "Manizales Tablazo",  marcas: ["KIA","Honda","FAW"],          direccion: "", horarioTaller: "", horarioVitrina: "" },
    { nombre: "Manizales Santander",marcas: ["KIA"],                        direccion: "", horarioTaller: "", horarioVitrina: "" },
    { nombre: "Cartago",            marcas: ["KIA","Usados"],               direccion: "", horarioTaller: "", horarioVitrina: "" },
    { nombre: "La Dorada",          marcas: ["KIA","Usados"],               direccion: "", horarioTaller: "", horarioVitrina: "" }
  ],

  // ===== CAMPAÑAS ACTIVAS =====
  campanias: [
    { id: "seguridad-kia",   titulo: "Campaña Seguridad KIA",  vigente: true, permanente: true },
    { id: "total-confianza", titulo: "Total Confianza KIA",    vigente: true, desde: "2026-05-19", hasta: "2026-08-31" }
  ],

  // ===== CONTENIDO FASE 3 (estructura lista, se completará desde /docs) =====
  // Se incluye una muestra representativa para que las vistas rendericen.
  inbound: [
    {
      paso: 6, titulo: "Cotizar", tiempo: "60 seg", marca: "KIA",
      validar: [
        "Confirmar tipo de combustión",
        "Verificar km actual",
        "Validar si hay síntomas reportados (afecta We Go)",
        "Datos del cliente ya en el panel derecho →"
      ],
      decir: '"Para el mantenimiento de los [KM] de su [MODELO] el valor es de $[PRECIO]. Incluye cambio de aceite y filtro, diagnóstico eléctrico, inspección multipunto, alineación, balanceo y rotación de llantas. No incluye filtro de aire motor, filtro A/C ni plumillas (sujetos a inspección del técnico). ¿Le agendamos su cita?"',
      hacer: [
        "Si dice sí → Paso 7 (We Go)",
        "Si dice \"lo pienso\" → enviar resumen WhatsApp",
        "Enviar tarjeta + mensaje desde el panel derecho"
      ],
      escalar: "Descuento >10% · modelo no en cotizador · cliente VIP · reclamo previo → Líder Posventa",
      tips: ["Si pregunta \"¿por qué tan caro?\" — muéstrale la lista de servicios del cotizador."]
    }
    // ... pasos 1-5 y 7-10 (Fase 3, desde flujo-inbound-posventa-10-pasos.md)
  ],

  outbound: {},        // Fase 3 — guiones-outbound-completo.md
  plantillas: [],      // Fase 3 — plantillas-whatsapp-unificadas.md
  calificador: {},     // Fase 3 — guion-comercial-calificador-integrado.md
  conocimiento: [],    // Fase 3 — base-conocimiento-completa.md
  contactos: [],       // Fase 3 — NUMEROS.xlsx
  extensiones: [],     // Fase 3 — Propuesta_IVR_Armotor.xlsx
  vip: []              // Fase 3 — base-conocimiento-completa.md
};
