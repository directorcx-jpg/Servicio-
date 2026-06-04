// =============================================================
//  data.js — Consola CETA Armotor
//  ES Module. Exporta TODO el contenido como un único objeto DATA.
//  Fase 1+2: usuarios/roles, cotizador local, tipificador.
//  Fase 3: contenido real de los 5 docs de /docs.
//  Módulo 3: cotizador KIA real (seed de precios + detalle de servicios).
// =============================================================
import { COTIZADOR_SEED } from './cotizador-seed.js?v=1.9.0';
import { FEED_DETALLE } from './feed-detalle.js?v=1.9.0';

export const DATA = {

  // ===== CONFIGURACIÓN GENERAL =====
  config: {
    version: "1.10.0",
    fecha: "Mayo 2026",
    owner: "Pablo Andrey Rincón",
    // Backend Apps Script. La URL /exec del despliegue se pega desde
    // Configuración → Conexión Apps Script (se guarda en localStorage).
    // `base` es una URL de respaldo opcional; normalmente queda vacía.
    endpoints: {
      base: "",                // URL /exec del Web App (se sobreescribe desde Config)
      guardarGestion: "",      // (legado) los endpoints reales usan ?action= sobre base
      actualizarGestion: "",
      consultarCotizador: "",
      buscarPlaca: ""
    },
    apiTimeoutMs: 3000,
    lineas: { Manizales: "3116097675", Armenia: "3148144259", Pereira: "3206320999" }
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
    { id: 5, nombre: "Alejandra Tabares",    alias: "Juan M",    rol: "asesor_cc",       pin: "1105", activo: true },
    { id: 6, nombre: "Julio Pineda",         alias: "Alejo",     rol: "asesor_cc",       pin: "1106", activo: true },
    { id: 7, nombre: "Paula Andrea Arévalo", alias: "Paula",     rol: "asesor_digital",  pin: "1107", activo: true },
    { id: 8, nombre: "Natalia Vargas",       alias: "Nata",      rol: "asesor_digital",  pin: "1108", activo: true },
    { id: 9, nombre: "Alejandro Castaño",    alias: "Coordinador Ceta", rol: "coordinador", pin: "1109", activo: true }
  ],

  permisos: {
    coordinador:    { homeEquipo: true,  registrar: true,  verCasos: "todos",   controlGestion: true,  modoTV: true,  reasignar: true,  editarContenido: true,  config: true,  internosAsignar: true,  exportar: true },
    analista:       { homeEquipo: true,  registrar: false, verCasos: "todos",   controlGestion: true,  modoTV: true,  reasignar: false, editarContenido: false, config: false, internosAsignar: false, exportar: true },
    asesor_cc:      { homeEquipo: false, registrar: true,  verCasos: "propios", controlGestion: "propios", modoTV: false, reasignar: false, editarContenido: false, config: false, internosAsignar: "ver", exportar: false },
    asesor_digital: { homeEquipo: false, registrar: true,  verCasos: "propios", controlGestion: "propios", modoTV: false, reasignar: false, editarContenido: false, config: false, internosAsignar: false, exportar: false }
  },

  // ===== COTIZADOR KIA (Módulo 3) =====
  // Fuentes: cotizador-seed.js (modelos/precios/combos, respaldo capa 3) y
  // feed-detalle.js (detalle de servicios por combustión+km, estático).
  // Solo KIA. Honda/FAW deshabilitados. Cálculo y búsqueda en app.js.
  cotizador: {
    soloMarca: "KIA",
    marcasDeshabilitadas: ["Honda", "FAW"],
    // combustión {tipo:[modelos]} y precios {modelo:[[desc,manoObra,repuestos,kit],...]}
    combustion: COTIZADOR_SEED.combustion,
    precios: COTIZADOR_SEED.precios,
    combos: COTIZADOR_SEED.combos,        // [[nombre, valor],...]
    detalle: FEED_DETALLE,                 // {combustion:{km:{total,incluido[],noIncluido[]}}}
    descuentos: ["0%","10%","20%","30%","40%","50%"],
    reglas: COTIZADOR_SEED.reglas,
    // No incluido por defecto (sujeto a inspección) cuando el km no esté en el detalle
    noIncluidoDefault: [
      "Cambio Filtro de Aire del A/C",
      "Cambio Filtro de Aire de Motor",
      "Cambio caucho plumillas"
    ]
  },

  // ===== TIPIFICADOR — Mapeo a Evolution =====
  tipificador: {
    servicioSigno: {
      "MANTENIMIENTO": "++",
      "REVISIÓN": "*",
      "GARANTÍA": "??",
      "INSPECCIÓN": "",
      "ESPECIALIZADA": "??"
    },
    resultadoEvo: {
      "agenda":      { estado: "CONTACTO",    causa: "AGENDAMIENTO EXITOSO" },
      "seg":         { estado: "CONTACTO",    causa: "VOLVER A LLAMAR" },
      "noc":         { estado: "NO CONTACTO", causa: "NO CONTESTA" },
      "sinKm":       { estado: "CONTACTO",    causa: "NO TIENE KILOMETRAJE" },
      "otroTaller":  { estado: "CONTACTO",    causa: "VISITA OTRO TALLER" },
      "noContactar": { estado: "CONTACTO",    causa: "NO VOLVER A CONTACTAR" }
    }
  },

  // ===== LISTAS EDITABLES DEL PANEL (Configuración → coordinador) =====
  // Alimentan los selects "Motivo del contacto" y "Servicio" del panel de cierre.
  // Editables desde Configuración; override en localStorage 'ceta_listas'.
  listas: {
    motivos: ["Mantenimiento", "Servicio rápido", "Garantía", "Cotización", "Información", "Queja", "Inspección", "Especializada", "Accesorios"],
    servicios: ["Mantenimiento", "Servicio rápido", "Revisión", "Garantía", "Inspección", "Especializada"]
  },

  // =============================================================
  //  CASOS INTERNOS — configuración de radicación y rotación
  // =============================================================
  internos: {
    // Tipos de servicio del formulario y a qué cola pertenecen.
    // Cola A (genera factura) · Cola B (no genera factura)
    tiposServicio: [
      { nombre: "Mantenimiento",  cola: "A" },
      { nombre: "Servicio rápido", cola: "A" },
      { nombre: "Accesorios",     cola: "A" },
      { nombre: "Garantía",       cola: "B" },
      { nombre: "Inspección",     cola: "B" },
      { nombre: "Especializada",  cola: "B" }
    ],
    colas: {
      A: { nombre: "Cola A · Genera factura" },
      B: { nombre: "Cola B · No genera factura" }
    },
    tiposRadicacion: ["Nuevo", "Reagendar"],
    gruposChat: ["Citas Taller", "G Manizales", "G Pereira", "G Armenia", "G La Dorada", "G Cartago"],
    propiedadDias: 10,     // REGLA 0: ventana de propiedad por placa
    slaMinutos: 5          // temporizador del caso se pone rojo a los 5 min
  },

  // =============================================================
  //  INBOUND POSVENTA — 10 pasos (flujo-inbound-posventa-10-pasos.md)
  // =============================================================
  inbound: [
    {
      paso: 1, titulo: "Apertura cálida", tiempo: "10 seg",
      validar: "Tener el sistema de gestión abierto y listo para registrar. Contestar antes del tercer timbre. Tono cálido pero profesional desde la primera palabra.",
      decir: [{ texto: '"Armotor, muy buenos días/tardes, le habla [NOMBRE_ASESOR], asesor de servicio. ¿Con quién tengo el gusto de hablar?"' }],
      hacer: "Registrar el nombre del cliente apenas lo diga. A partir de aquí, dirigirse siempre a él por su nombre con Sr./Sra./Don/Doña.",
      escalar: null,
      nota: "No se menciona la marca (KIA/Honda/FAW) en la apertura, porque Armotor representa varias marcas. Tampoco se usa el slogan aquí; se reserva para el cierre. Evitar apodos como «mi reina» o «mi amor»."
    },
    {
      paso: 2, titulo: "Identificar el motivo", tiempo: "15 seg",
      validar: "Escuchar sin interrumpir. Dejar que el cliente exprese su necesidad con sus propias palabras antes de encauzar la conversación.",
      decir: [{ texto: '"Con mucho gusto, Sr./Sra. [NOMBRE_CLIENTE]. Cuénteme, ¿en qué le puedo ayudar hoy?"' }],
      hacer: "Clasificar mentalmente el motivo: mantenimiento, síntoma o falla, cotización, garantía, reagenda, información. Esta clasificación define el resto del flujo y la futura tipificación.",
      escalar: null, nota: null
    },
    {
      paso: 3, titulo: "Identificar necesidad y síntomas", tiempo: "30 seg", critico: true,
      validar: "Este paso decide si más adelante se podrá ofrecer We Go. Si el vehículo presenta un síntoma que requiere diagnóstico, NO se ofrecerá recogida, porque el técnico necesita hacer la prueba de ruta junto al cliente.",
      decir: [
        { texto: '"Perfecto. Para brindarle el mejor servicio, ¿su vehículo presenta algún sonido, vibración, desajuste o comportamiento extraño que desee reportar?"' },
        { sub: "Si reporta un síntoma", texto: '"Entiendo. Tomo nota de ese detalle para que el técnico lo revise con atención."' }
      ],
      hacer: "Anotar el síntoma textualmente (será la «voz del cliente» en la tipificación). Marcar internamente si el caso requiere prueba de ruta, porque eso bloquea el ofrecimiento de We Go en el paso 7.",
      escalar: "Si menciona luz de Check Engine encendida, pérdida de potencia, ruido metálico fuerte en el motor o testigo de temperatura en rojo: no improvisar respuesta técnica. Pedir foto del tablero, escalar al Líder de Posventa y responder: «Para darle la mejor orientación sobre ese testigo, permítame validar con nuestro equipo técnico y en unos minutos le confirmo.»",
      nota: null
    },
    {
      paso: 4, titulo: "Recopilar datos", tiempo: "45 seg",
      validar: "Pedir los datos en orden, sin abrumar. Confirmar que el número de contacto sea el correcto para WhatsApp.",
      decir: [{ texto: '"Para agendarle su cita, ¿me confirma los siguientes datos, por favor?\n• Placa y modelo del vehículo\n• Kilometraje aproximado actual\n• Ciudad donde se encuentra el vehículo\n• Un número de contacto\n• Y para terminar de actualizar su registro, ¿me regala su fecha de nacimiento?"' }],
      hacer: "Registrar todo en el sistema. Si el cliente ya existe, actualizar teléfono y correo si cambiaron.",
      escalar: null,
      nota: "Por qué la fecha de nacimiento: enriquece la base para campañas de cumpleaños y segmentación. Si pregunta para qué es: «Es para tenerlo en cuenta en beneficios y atenciones especiales que manejamos.»"
    },
    {
      paso: 5, titulo: "Confirmar los datos", tiempo: "20 seg",
      validar: "Repetir siempre, aunque el cliente acabe de dar la información. La confirmación evita citas mal agendadas y reclamos.",
      decir: [{ texto: '"Le confirmo entonces: vehículo placa [PLACA], [MODELO], con [KILOMETRAJE] kilómetros, en [CIUDAD], a nombre de [NOMBRE_CLIENTE], número de contacto [TELÉFONO]. ¿Es correcta la información?"' }],
      hacer: "Corregir en el momento cualquier dato erróneo. No avanzar hasta que el cliente confirme.",
      escalar: null, nota: null
    },
    {
      paso: 6, titulo: "Cotizar y explicar qué incluye y qué NO", tiempo: "60 seg", marca: null,
      validar: "Confirmar el tipo de combustión del vehículo (combustión, híbrido o eléctrico), porque el plan de mantenimiento cambia. Tener abierto el Cotizador con el modelo y kilometraje correctos.",
      decir: [{ texto: '"Para el mantenimiento de los [KILOMETRAJE] de su [MODELO], el valor aproximado es de $[PRECIO]. Incluye: cambio de aceite y filtro de motor, diagnóstico eléctrico, inspección de frenos, suspensión, dirección, sistema eléctrico, alineación, balanceo, rotación de llantas y revisión de más de 30 puntos.\n\nEs importante que sepa que NO incluye cambio de filtro de aire del motor, filtro de aire acondicionado ni cauchos de plumillas; estos quedan sujetos a la inspección del técnico y se cotizan aparte. El lavado incluido es enjuague exterior y aspirado; si desea algo más completo, manejamos combos de embellecimiento."' }],
      hacer: "Enviar por WhatsApp el mensaje generado por el Cotizador (no la imagen genérica del manual). Registrar la tipificación «Cotización entregada».",
      escalar: "Si el cliente pide un descuento mayor al estándar autorizado, o si el modelo/kilometraje no aparece en el Cotizador, consultar al Líder de Posventa antes de comprometer un valor.",
      nota: "Tip: Si dice que está caro, apoyarse en el detalle completo de servicios. Cuando entiende todo lo que se hace, el precio se justifica solo."
    },
    {
      paso: 7, titulo: "Ofrecer We Go SIN COSTO", tiempo: "30 seg",
      validar: "Ofrecer We Go ANTES de definir el día. Solo ofrecer si en el paso 3 NO se reportó un síntoma que requiera prueba de ruta. Se ofrece sin costo como beneficio ligado a realizar el mantenimiento con nosotros; es la herramienta de cierre.",
      decir: [
        { sub: "Sin síntomas", texto: '"Sr./Sra. [NOMBRE_CLIENTE], tengo una muy buena noticia: como va a realizar su mantenimiento con nosotros, le incluimos sin ningún costo nuestro servicio We Go. Recogemos su vehículo en la dirección que nos indique, le hacemos el servicio y se lo devolvemos, sin que usted tenga que desplazarse. ¿Le coordino la recogida?"' },
        { sub: "Con síntomas", texto: '"Para este caso, donde se requiere un diagnóstico, le recomiendo traer el vehículo directamente al taller, porque el técnico necesita hacer una prueba de ruta junto con usted. Así le damos la mejor solución."' }
      ],
      hacer: "Si acepta We Go, registrar dirección y validar disponibilidad para la fecha deseada. Si lo trae personalmente, continuar al paso 8.",
      escalar: null,
      nota: "Cambio de enfoque (mayo 2026): We Go es ahora un beneficio SIN COSTO. Ya no se maneja como objeción de precio; es un gancho de cierre. El objetivo es que We Go convierta un «lo pienso» en un «sí, agéndelo»."
    },
    {
      paso: 8, titulo: "Validar día y hora", tiempo: "30 seg",
      validar: "Tener clara la disponibilidad real de la sede. En Manizales, manejar las tres alternativas según comodidad del cliente y tipo de servicio.",
      decir: [
        { sub: "Caso general", texto: '"¿Qué día y hora le quedan cómodos? Tengo disponibilidad para [OPCIONES]."' },
        { sub: "Manizales (3 alternativas)", texto: '"En Manizales tenemos dos talleres. Puede dejar el vehículo en la sede principal de la Santander, donde lo recibimos; si requiere alineación/balanceo o algo especializado, con su autorización lo bajamos al Alto Tablazo y se lo devolvemos en la Santander. O traerlo directamente al Alto Tablazo. Y también está We Go, donde lo recogemos en casa. ¿Cuál le queda mejor?"' }
      ],
      hacer: "Confirmar fecha y hora. Validar pico y placa según ciudad y último dígito de placa. Registrar la cita.",
      escalar: null,
      nota: "Objetivo de fondo en Manizales: incentivar siempre que el cliente lleve el vehículo al taller. Las tres alternativas reducen la fricción."
    },
    {
      paso: 9, titulo: "Ofrecer Telemetría", tiempo: "40 seg",
      validar: "Ofrecer en el cierre, una vez la cita está asegurada. Aplica a vehículos KIA. Es un valor agregado, no una venta a presión.",
      decir: [{ texto: '"Para terminar, quería comentarle algo que hemos implementado: el servicio de Telemetría. Le instalamos un GPS para geolocalizar su vehículo desde el celular. Si por algún motivo se lo llevan, lo puede seguir e incluso apagar el motor desde su teléfono, y contamos con central de monitoreo 24 horas. Es un pago anual único con un valor preferencial para clientes Armotor. ¿Le gustaría que se lo incluyamos en su cita?"' }],
      hacer: "Si acepta, registrar el interés y coordinar la instalación en la cita. Si no, sembrar sin insistir: «Sin problema, se lo dejo comentado por si más adelante le interesa.» Detalle completo en el módulo de Telemetría (BdC).",
      escalar: null, nota: null
    },
    {
      paso: 10, titulo: "Cierre con asesor receptor", tiempo: "40 seg",
      validar: "Antes de cerrar, repasar el checklist: datos confirmados, cita agendada, We Go o sede definida, recomendaciones por dar.",
      decir: [{ texto: '"Le confirmo: quedamos agendados para el [DÍA] [FECHA] a las [HORA] en [SEDE], con [NOMBRE_ASESOR_SERVICIO], quien recibe su vehículo y le informa el tiempo aproximado de entrega.\n\nLe recuerdo llegar con puntualidad y disponer de 15 a 30 minutos para la recepción. Por favor traiga su tarjeta de propiedad, el manual de garantías y la llave de pernos si la tiene. No deje objetos personales en el vehículo.\n\n¿Le puedo colaborar en algo más? Muchas gracias por preferirnos, Sr./Sra. [NOMBRE_CLIENTE]. Que tenga un excelente día."' }],
      hacer: "Cerrar la tipificación (resultado: Agendamiento exitoso). Generar la nota para Quiter/iVuo. Enviar al cliente el resumen de la cita por WhatsApp. Programar seguimiento si quedó pendiente.",
      escalar: null,
      nota: "Cierre opcional con slogan: «Recuerde: Armotor le pone motor a su vida.» — pero nunca en la apertura."
    }
  ],

  // =============================================================
  //  OUTBOUND — 4 tipos + Recuperación Honda/FAW (guiones-outbound-completo.md)
  // =============================================================
  outboundEstructura: [
    "Apertura: confirmar identidad, presentarse, dar motivo claro en una frase.",
    "Gancho: la razón por la que vale la pena que el cliente escuche.",
    "Captura/Validación: datos necesarios y detección de novedades.",
    "Oferta: mantenimiento + We Go sin costo + Telemetría (si aplica).",
    "Cierre: agendar o programar seguimiento concreto."
  ],
  outbound: [
    {
      id: "advance", titulo: "Advance — Primer Mantenimiento", badge: "Garantía", marca: "KIA · Honda · FAW",
      contexto: "El cliente compró un vehículo nuevo con Armotor y se acerca a los 10.000 km o a los 12 meses desde la matrícula (lo primero que se cumpla). La marca exige ese primer mantenimiento para mantener la garantía vigente. Es la llamada más valiosa porque establece el vínculo con un cliente nuevo.",
      validar: "Antes de llamar, tener a la vista: nombre, modelo, fecha de matrícula, placa, teléfono. Calcular si está próximo por km o por tiempo. Si cumple un año sin importar el km, el mantenimiento aplica igual.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor, mi nombre es [NOMBRE_ASESOR]. El motivo de mi llamada es que su [MODELO], matriculado el [FECHA_MATRICULA], está próximo a cumplir su primer servicio de mantenimiento y quiero ayudarle a que todo quede al día con su garantía. ¿Tiene un minuto?"' },
        { titulo: "Gancho (garantía)", texto: '"La marca recomienda el primer mantenimiento a los 10.000 km o al cumplir los 12 meses, lo primero que ocurra. Realizarlo en nuestro taller autorizado le garantiza que su vehículo conserva la garantía de fábrica completa y queda registrado en el historial oficial."' },
        { titulo: "Captura rápida", texto: '"¿Me puede confirmar en cuántos kilómetros tiene su vehículo actualmente?"' },
        { titulo: "Si se acerca al año sin km", texto: '"Aunque no haya llegado a los 10.000, como ya se acerca al año, el mantenimiento aplica igual por tiempo. Lo bueno es que estamos a tiempo para que todo quede al día."' },
        { titulo: "Oferta con We Go", texto: '"Y le tengo una excelente noticia: le incluimos sin ningún costo nuestro servicio We Go. Recogemos su vehículo en la dirección que nos indique, le hacemos el mantenimiento completo y se lo devolvemos. ¿Le coordino la recogida?"' },
        { titulo: "Si dice «más adelante»", texto: '"Perfecto. Le voy a enviar un resumen por WhatsApp con la información del servicio y el valor. Y cuando se acerque, me llama o me escribe y le agendamos de una vez. ¿Le parece?"' }
      ],
      hacer: "Si acepta: continuar con pasos 8, 9 y 10 del Inbound. Si no acepta: enviar plantilla WhatsApp de primer mantenimiento, registrar «en seguimiento» y programar recontacto.",
      escalar: "Si el cliente ya hizo el mantenimiento en otro taller: no presionar, registrar como «visita otro taller» y preguntar amablemente el motivo."
    },
    {
      id: "recA", titulo: "Recuperación A — Ausencia 6 a 12 meses", badge: "Cliente reciente", marca: "KIA · Honda · FAW",
      contexto: "Cliente que no ha regresado en 6 a 12 meses. Tono de continuidad.",
      validar: "Revisar historial: último servicio, modelo, km del último ingreso. Calcular km estimado actual.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor, mi nombre es [NOMBRE_ASESOR]. Lo llamo porque usted es un cliente importante y vemos que su [MODELO] podría estar cerca de su próximo mantenimiento. ¿Tiene un minuto?"' },
        { titulo: "Gancho (continuidad)", texto: '"En su última visita quedó con [KM_ANTERIOR] km. Si ha rodado normalmente, es probable que ya esté cerca de los [KM_SIGUIENTE] que es cuando corresponde el siguiente servicio. Mantener los mantenimientos al día protege la garantía y el valor de reventa."' },
        { titulo: "Oferta con We Go", texto: '"Y ahora le incluimos sin costo nuestro servicio We Go: le recogemos el vehículo en su casa, le hacemos el mantenimiento y se lo devolvemos. ¿Le agendo?"' }
      ],
      hacer: "Si acepta: pasos 8, 9 y 10 del Inbound. Si no: plantilla WhatsApp de recuperación, registrar motivo y programar recontacto.",
      escalar: "Si visitó otro taller: registrar la razón (precio, ubicación, proveedor)."
    },
    {
      id: "recB", titulo: "Recuperación B — Ausencia 12 a 24 meses", badge: "Cliente tibio", marca: "KIA · Honda · FAW",
      contexto: "Cliente que no ha regresado en 12 a 24 meses. Énfasis en garantía y diferencial.",
      validar: "Revisar historial y último ingreso. Recordar el diferencial de garantía extendida.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor, mi nombre es [NOMBRE_ASESOR]. Lo contacto porque ha pasado un tiempo desde la última vez que atendimos su [MODELO] y no queremos que pierda los beneficios de la garantía. ¿Me permite un momento?"' },
        { titulo: "Gancho (garantía + diferencial)", texto: '"La garantía de su vehículo se mantiene activa mientras los mantenimientos se realicen en la red autorizada. Si ha pasado más de un año, es recomendable una revisión para actualizar el registro. Y le recuerdo que en Armotor somos los únicos que ofrecemos la garantía extendida de la marca."' },
        { titulo: "Oferta con We Go", texto: '"Para facilitarle todo, ahora recogemos su vehículo sin ningún costo con We Go. Lo recogemos, lo atendemos y se lo devolvemos. ¿Qué día le queda bien?"' }
      ],
      hacer: "Si acepta: pasos 8, 9 y 10 del Inbound. Si no: plantilla WhatsApp de recuperación, registrar motivo.",
      escalar: "Si visitó otro taller: registrar la razón (precio, ubicación, proveedor)."
    },
    {
      id: "recC", titulo: "Recuperación C — Ausencia +24 meses", badge: "Cliente frío", marca: "KIA · Honda · FAW",
      contexto: "Cliente que no ha regresado en más de 24 meses. Oferta diferenciada.",
      validar: "Revisar historial. Si el vehículo tiene alto kilometraje (>80.000 km), enfatizar repuestos y aceite originales.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor, mi nombre es [NOMBRE_ASESOR]. Lo contacto porque queremos reactivar su relación con nosotros y ofrecerle un beneficio especial para su [MODELO]."' },
        { titulo: "Gancho (oferta diferenciada)", texto: '"Entendemos que ha pasado un tiempo. Por eso queremos hacerle una propuesta especial: un servicio de cambio de aceite y revisión multipunto a un valor preferencial, con repuestos originales y técnicos certificados por la marca."' },
        { titulo: "Alto kilometraje (>80.000 km)", texto: '"Para vehículos con el rodaje del suyo, es especialmente importante usar repuestos y aceite originales. Le ofrecemos un escaneo completo, revisión de puntos de control y cambio de aceite con lubricante certificado. Es la mejor forma de cuidar su inversión."' },
        { titulo: "Oferta con We Go", texto: '"Y además, le recogemos el vehículo sin costo en su casa. Nosotros nos encargamos de todo."' }
      ],
      hacer: "Si acepta: pasos 8, 9 y 10 del Inbound. Si no: plantilla WhatsApp de recuperación, registrar motivo.",
      escalar: "Si visitó otro taller: registrar la razón (precio, ubicación, proveedor)."
    },
    {
      id: "seguridadKIA", titulo: "Campaña Seguridad KIA", badge: "Obligatoria · gratuita", marca: "KIA",
      contexto: "Campañas de seguridad obligatorias emitidas por Metrokia (comunicado CI_C_Kia_008_2026). Intervenciones gratuitas y preventivas. Obligatorio contactar a todos los clientes de la base y registrar el resultado en el Excel compartido.",
      validar: "Confirmar que las partes/repuestos están disponibles en bodega. Si no hay stock, NO contactar hasta tenerlas. Tener a la vista: VIN (últimos 4 dígitos), modelo, año, nombre, teléfono, ciudad.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor KIA, mi nombre es [NOMBRE_ASESOR]. Lo llamo porque tenemos información importante sobre su vehículo. ¿Tiene un momento?"' },
        { titulo: "Comunicación de la campaña", texto: '"Le informamos que su KIA [MODELO] [AÑO], con el VIN terminado en [ÚLTIMOS 4 VIN], presenta una campaña de seguridad vigente. Son intervenciones gratuitas y preventivas que mantienen su vehículo actualizado y seguro. No tiene ningún costo para usted, independientemente del estado de la garantía."' },
        { titulo: "Cierre", texto: '"¿Le agendamos una cita para realizar la intervención? Nosotros nos encargamos de todo."' },
        { titulo: "Si rechaza", texto: '"Entiendo. Esta información queda registrada y puede consultar las campañas activas en kia.com.co/campanas-de-seguridad. Si decide realizarla, estamos a su disposición."' },
        { titulo: "Si está en otra ciudad", texto: '"¿En qué ciudad se encuentra actualmente? Le registro para que el concesionario más cercano lo pueda contactar."' }
      ],
      hacer: "Registrar el resultado exacto en el Excel (No contesta / Teléfonos incorrectos / Rechaza / Otra ciudad / Acepta / Ya intervenido). Si acepta, agendar. Si está en otra ciudad, registrar la «Ciudad Real». Enviar el correo con la plantilla oficial (asunto: «Campaña de Seguridad en Vehículos – Kia [MODELO] – Acción requerida») y marcar «Correo enviado – Sí/No».",
      escalar: "Si no hay repuestos para la campaña: notificar al jefe regional de servicio por correo y registrar en «Observaciones». No contactar al cliente hasta tener las partes."
    },
    {
      id: "totalConfianza", titulo: "Total Confianza KIA — Recuperación 600 días", badge: "Vig. 19 may–31 ago", marca: "KIA",
      contexto: "Campaña de Metrokia con lubricantes Total. Vigencia 19 mayo a 31 agosto 2026. Recuperar clientes con +600 días sin ingresar. Modelos: Picanto, K3, Soluto, Rio (lubricante 5W30). Meta: 200 prospectos. Base suministrada por Metrokia.",
      validar: "Confirmar que el cliente está en la base de Metrokia. Verificar modelo Picanto, K3, Soluto o Rio. Confirmar stock de aceite Total 5W30. Tener claro el beneficio a comunicar.",
      momentos: [
        { titulo: "Apertura", texto: '"Muy buenos días/tardes, ¿hablo con [NOMBRE_CLIENTE]? Le saludo de Armotor KIA, mi nombre es [NOMBRE_ASESOR]. Lo contacto porque queremos reconectarnos con usted y hacerle una propuesta especial para su [MODELO]."' },
        { titulo: "Gancho (beneficio especial)", texto: '"Vemos que hace un tiempo no nos visita y no queremos que se pierda los beneficios. Le tenemos una oferta especial: un servicio de mantenimiento con condiciones preferenciales, repuestos originales y técnicos certificados. Es nuestra forma de darle la bienvenida de vuelta."' },
        { titulo: "We Go como cierre", texto: '"Y lo mejor: le recogemos el vehículo sin ningún costo con We Go. Lo recogemos en su casa, le hacemos todo el servicio y se lo devolvemos listo. ¿Qué día le queda bien?"' },
        { titulo: "Si visitó otro taller", texto: '"Lo entendemos. Cuando el mantenimiento se hace en la red autorizada, su vehículo conserva la garantía, se usan repuestos 100% originales y queda registrado en el historial oficial, lo que incrementa su valor de reventa. La oferta es válida hasta agosto. ¿Le gustaría conocer más?"' },
        { titulo: "Si dice «no me interesa»", texto: '"Entiendo perfectamente, respeto su decisión. En Armotor siempre estamos disponibles. Mantener el mantenimiento al día protege su valor de reventa y su garantía. Si cambia de opinión, aquí estoy. ¡Que tenga un excelente día!"' }
      ],
      hacer: "Si acepta: pasos 8, 9 y 10 del Inbound. Asegurar que en la OT quede registrado como cliente Total Confianza (para el recobro a Metrokia). Tomar foto con banner de Total Energies visible. Si no acepta: plantilla WhatsApp de recuperación y registrar resultado.",
      escalar: "Si pregunta por el precio exacto, consultar el valor con las condiciones preferenciales de la campaña. Si solicita descuentos adicionales, escalar al Líder de Posventa."
    },
    {
      id: "recHonda", titulo: "Recuperación Honda", badge: "Mismo flujo que Rec. B", marca: "Honda",
      contexto: "Aplica la misma estructura del Outbound de Recuperación. La diferencia es el gancho, adaptado a Honda.",
      validar: "Revisar historial del cliente Honda.",
      momentos: [
        { titulo: "Gancho Honda", texto: '"Honda ofrece una garantía robusta para su [MODELO] y mantener los mantenimientos al día en la red autorizada es clave para que esa garantía se mantenga activa. Además, cada servicio queda registrado en el historial oficial de Honda, lo que protege el valor de su vehículo."' }
      ],
      hacer: "Continuar con pasos 8, 9 y 10. Telemetría no aplica para Honda.",
      escalar: "Beneficio diferenciado de recuperación Honda: PENDIENTE que Pablo lo defina."
    },
    {
      id: "recFAW", titulo: "Recuperación FAW", badge: "Mismo flujo que Rec. B", marca: "FAW",
      contexto: "Aplica la misma estructura del Outbound de Recuperación. Gancho adaptado a FAW.",
      validar: "Revisar historial del cliente FAW.",
      momentos: [
        { titulo: "Gancho FAW", texto: '"En Armotor somos el taller autorizado FAW en el Eje Cafetero. Nuestros técnicos conocen su [MODELO] y usamos repuestos 100% originales. Queremos asegurarnos de que su vehículo reciba la mejor atención."' }
      ],
      hacer: "Continuar con pasos 8, 9 y 10. Telemetría no aplica para FAW.",
      escalar: "Beneficio diferenciado de recuperación FAW: PENDIENTE que Pablo lo defina."
    }
  ],

  // =============================================================
  //  PLANTILLAS WHATSAPP — 25 plantillas, 8 categorías
  //  (plantillas-whatsapp-unificadas.md)
  // =============================================================
  plantillasCategorias: [
    "Saludos y apertura", "Captura de datos", "Disponibilidad y agendamiento",
    "Cotización y precio", "Confirmación de cita", "Objeciones y seguimiento",
    "Cierre y gestión de chat", "Comercial / Leads"
  ],
  plantillas: [
    { id: "1.1", cat: "Saludos y apertura", titulo: "Saludo inicial asesor", usar: "El cliente escribe por primera vez o se le asigna un chat.", vars: ["NOMBRE_ASESOR"],
      texto: "¡Hola! 👋 Mucho gusto, mi nombre es *[NOMBRE_ASESOR]*, asesor de Armotor.\n\nGracias por comunicarse con nosotros. ¿En qué le puedo ayudar?" },
    { id: "1.2", cat: "Saludos y apertura", titulo: "Bienvenida bot (automática)", usar: "Mensaje automático de primer contacto en el canal.", vars: [],
      texto: "¡Hola! 👋 Bienvenido a *Armotor*.\n\n🛡️ Al enviarnos tus datos, aceptas nuestra Política de Tratamiento de Datos Personales. Armotor S.A.S. garantiza tus derechos de habeas data.\nMás info: https://armotor.com/politicas-de-tratamiento-de-datos-personales/\n\n¿Con qué te puedo ayudar hoy?" },
    { id: "1.3", cat: "Saludos y apertura", titulo: "Saludo campaña activa", usar: "Se contacta al cliente como parte de una campaña. Reemplazar [CAMPAÑA] y [BENEFICIO].", vars: ["NOMBRE_ASESOR","CAMPAÑA","BENEFICIO"],
      texto: "¡Hola! 👋 Soy *[NOMBRE_ASESOR]* de Armotor KIA. Le escribo porque este mes tenemos *[CAMPAÑA]* y no quería que se le pasara esta oportunidad.\n\n[BENEFICIO]\n\n¿Le agendo su cita? Solo necesito que me confirme el día que le funciona mejor. 😊" },

    { id: "2.1", cat: "Captura de datos", titulo: "Solicitar datos para agendar", usar: "El cliente quiere agendar y necesitas la información básica.", vars: [],
      texto: "Para agendar tu cita de mantenimiento, por favor indícame:\n\n📌 Nombre completo\n📌 Placa del vehículo\n📌 Kilometraje aproximado actual\n📌 Ciudad donde se encuentra el vehículo\n📌 Motivo o tipo de mantenimiento\n\nCon estos datos te agendo de inmediato. 😊" },
    { id: "2.2", cat: "Captura de datos", titulo: "Validar novedades y adicionales", usar: "Ya tienes los datos básicos y necesitas saber si hay síntomas antes de ofrecer We Go.", vars: [],
      texto: "Antes de confirmarle los horarios disponibles, ¿su vehículo presenta algún adicional que reportar? Como sonidos, desajustes o vibraciones.\n\nTambién, *¿me confirma el aproximado de kilómetros de su vehículo?* 🚗" },
    { id: "2.3", cat: "Captura de datos", titulo: "Explicar mantenimiento por km o tiempo", usar: "El cliente no sabe si le toca mantenimiento o cree que aún no cumple el kilometraje.", vars: ["MES"],
      texto: "Le cuento algo importante: el mantenimiento de su KIA se programa *por kilometraje o por tiempo*, lo primero que se cumpla.\n\nDependiendo de la referencia, puede ser cada 10.000 km. Entonces, aunque su vehículo cumpla el año en *[MES]*, es posible que por kilometraje ya esté cerca o ya haya pasado el momento.\n\n*¿Me puede regalar el kilometraje que marca su tablero en este momento?* 🚗 Así le confirmo si ya es hora y le ayudo a programar su cita." },

    { id: "3.1", cat: "Disponibilidad y agendamiento", titulo: "Ofrecer disponibilidad", usar: "Vas a proponer fechas y horarios disponibles.", vars: ["CIUDAD","FECHA","HORA_1","HORA_2","HORA_3"],
      texto: "Ya le confirmo la disponibilidad más cercana en *[CIUDAD]* 📍\n\nPara *[FECHA]* tengo disponibilidad:\n• *[HORA_1]*\n• *[HORA_2]*\n• *[HORA_3]*\n\n¿Cuál le confirmo? ✅" },
    { id: "3.2", cat: "Disponibilidad y agendamiento", titulo: "Preguntar preferencia de día", usar: "El cliente no ha indicado preferencia de fecha.", vars: [],
      texto: "Claro que sí 😊\n\n¿Para qué día le queda cómodo ingresar? Yo le verifico la disponibilidad y le agendo con mucho gusto. 📅" },
    { id: "3.3", cat: "Disponibilidad y agendamiento", titulo: "Cita reagendada", usar: "Se cambia una cita ya confirmada.", vars: ["NUEVA_FECHA","NUEVA_HORA","CIUDAD","NOMBRE_ASESOR_SERVICIO"],
      texto: "Le confirmo que su cita quedó *reagendada* para:\n\n📅 *[NUEVA_FECHA]* a las *[NUEVA_HORA]*\n📍 *[CIUDAD]*\n👤 Con *[NOMBRE_ASESOR_SERVICIO]*\n\n¡Lo esperamos! 🚗" },

    { id: "4.1", cat: "Cotización y precio", titulo: "Cotización de mantenimiento", usar: "Se envía el detalle del mantenimiento. Se genera desde el Cotizador del portal.", vars: ["MODELO","KM","N","PRECIO","MES_ACTUAL"],
      texto: "*Mantenimiento [MODELO] – [KM] km* 🔧\n\n✅ *Incluye ([N] servicios):*\n• Cambio aceite y filtro motor\n• Diagnóstico eléctrico especializado\n• Inspección de frenos, suspensión, dirección\n• Alineación, balanceo y rotación de llantas\n• Revisión de [N] puntos de control\n• Prueba de ruta\n• Lavado exterior y aspirado interior\n\n⚠️ *NO incluido* (sujeto a inspección del técnico):\n• Cambio filtro aire motor\n• Cambio filtro aire A/C\n• Cambio cauchos plumillas\n\n💰 *Valor aproximado:* $[PRECIO]\n⚠️ Precios sujetos a variación: precios mes de *[MES_ACTUAL]*\n\n📋 *Llevar:* tarjeta de propiedad, manual de garantías, llave de pernos (si tiene)\n\n¿Le confirmo su cita? 📅" },
    { id: "4.2", cat: "Cotización y precio", titulo: "No cumple kilometraje aún", usar: "El cliente tiene pocos kilómetros y no le corresponde mantenimiento todavía.", vars: ["KM_ACTUAL","KM_SIGUIENTE"],
      texto: "¡Perfecto! Con *[KM_ACTUAL]* km aún tienes margen tranquilo. Tu primer mantenimiento sería al llegar a los *[KM_SIGUIENTE]* km o al cumplir el año, lo primero que pase.\n\nTe recomiendo que estés pendiente del kilometraje y cuando te acerques nos escribas por aquí o nos llames para agendarte. Nosotros también te vamos a estar recordando. 😊\n\nY si antes de eso tienes alguna duda o necesitas algo para tu vehículo, aquí estamos para ayudarte. 🚗" },

    { id: "5.1", cat: "Confirmación de cita", titulo: "Confirmación completa (oficial)", usar: "Se confirma una cita con todos los detalles. Plantilla estándar del CETA.", vars: ["DÍA_SEMANA","FECHA_COMPLETA","HORA","CIUDAD","NOMBRE_ASESOR_SERVICIO","TIPO_SERVICIO","PRECIO","DIRECCIÓN_COMPLETA"],
      texto: "✅ *LE CONFIRMO SU CITA*\n\n📅 *Fecha:* [DÍA_SEMANA] [FECHA_COMPLETA]\n🕐 *Hora:* [HORA]\n📍 *Ciudad:* [CIUDAD]\n👤 *Asesor de Servicio:* [NOMBRE_ASESOR_SERVICIO]\n\n🔧 *Servicio:* [TIPO_SERVICIO]\n💰 *Valor aproximado:* $[PRECIO]\n\n📍 *Dirección:* [DIRECCIÓN_COMPLETA]\n\n⚠️ *RECOMENDACIONES:*\n• Llegar con puntualidad a la hora asignada\n• Disponer de 15 a 30 minutos para recepcionar el vehículo\n• No incluye cambio de filtro de A/C ni plumillas (sujetos a verificación)\n• El lavado es básico (enjuague + aspirado); combos de embellecimiento disponibles\n\n📄 *Llevar:*\n• Tarjeta de propiedad\n• Manual de garantías\n• Llave de pernos (si tiene)\n\n*¿Le puedo colaborar en algo más?* 😊" },
    { id: "5.2", cat: "Confirmación de cita", titulo: "Confirmación corta", usar: "Confirmación rápida cuando el cliente ya tiene el contexto.", vars: ["FECHA","HORA","CIUDAD","NOMBRE_ASESOR_SERVICIO"],
      texto: "Cita confirmada ✅\n\n📅 *[FECHA]* a las *[HORA]* en *[CIUDAD]*\n👤 Con *[NOMBRE_ASESOR_SERVICIO]*\n\nRecuerde llegar puntual y traer tarjeta de propiedad y manual de garantías. ¡Lo esperamos! 🚗" },

    { id: "6.1", cat: "Objeciones y seguimiento", titulo: "Cliente dice «lo voy a pensar»", usar: "El cliente no se decide pero no rechaza.", vars: [],
      texto: "¡Claro que sí! Tómese su tiempo con toda tranquilidad. 😊\n\nPara que no se le pase, ¿qué le parece si le reservo un espacio tentativo y si decide no tomarlo, lo cancelamos sin ningún compromiso? Así se asegura de tener disponibilidad en el día y horario que más le convenga. ¿Qué dice? 📅" },
    { id: "6.2", cat: "Objeciones y seguimiento", titulo: "Cliente dice «no me interesa»", usar: "Rechazo directo. Mantener la puerta abierta.", vars: [],
      texto: "Entiendo perfectamente, respeto su decisión. 🙏\n\nSolo quiero que sepa que en Armotor siempre estamos disponibles cuando lo necesite. Mantener el mantenimiento al día no solo cuida su vehículo sino que también protege su valor de reventa y su garantía.\n\nSi en algún momento cambia de opinión o necesita cualquier asesoría con su vehículo, aquí estoy para ayudarle. ¡Que tenga un excelente día! 😊" },
    { id: "6.3", cat: "Objeciones y seguimiento", titulo: "Cliente dice «lo llevo a otro taller»", usar: "El cliente tiene otro taller de confianza.", vars: [],
      texto: "Entiendo, y es válido que tenga su taller de confianza. 👍\n\nSin embargo, le comparto un dato importante: cuando el mantenimiento se realiza en nuestra red autorizada, su vehículo *conserva la garantía de fábrica vigente*, se utilizan repuestos 100% originales y nuestros técnicos están certificados directamente por la marca. Además, cada servicio queda registrado en el historial oficial del vehículo, lo que incrementa su valor de reventa.\n\nSi alguna vez quiere una segunda opinión o comparar, lo invitamos con todo gusto. 😊" },
    { id: "6.4", cat: "Objeciones y seguimiento", titulo: "Cliente dice «no tengo el kilometraje»", usar: "El vehículo no llega al km pero ya cumple o se acerca al tiempo.", vars: [],
      texto: "¡Perfecto, gracias por compartirme eso! 😊\n\n*¿Me puede indicar aproximadamente en cuántos kilómetros tiene su vehículo actualmente?*\n\nRecuerde que el mantenimiento no solo se mide por kilometraje sino también por tiempo. Si ha pasado más de 12 meses desde su último servicio, es recomendable realizar una revisión sin importar el kilometraje.\n\nSi aún no le toca, se la podemos guardar para cuando sea su momento. ¿Le parece?" },
    { id: "6.5", cat: "Objeciones y seguimiento", titulo: "Seguimiento (segundo contacto)", usar: "Se recontacta a un cliente con quien ya se habló.", vars: ["NOMBRE_CLIENTE","MODELO"],
      texto: "¡Hola [NOMBRE_CLIENTE]! 👋\n\nTe escribo nuevamente de Armotor. Hace unos días hablamos sobre el mantenimiento de tu *[MODELO]*.\n\n¿Pudiste revisar la información? ¿Tienes alguna duda que pueda resolver?\n\nRecuerda que te *recogemos el vehículo sin costo* con nuestro servicio We Go. Solo dime el día y me encargo de todo. 🚗" },

    { id: "7.1", cat: "Cierre y gestión de chat", titulo: "Cierre estándar", usar: "La gestión terminó exitosamente.", vars: [],
      texto: "*¿Le puedo colaborar en algo más?* 😊\n\nPara servirle, gracias por preferirnos. ¡Que tenga un excelente día! 🚗" },
    { id: "7.2", cat: "Cierre y gestión de chat", titulo: "Cliente no responde (30+ min)", usar: "El cliente lleva más de 30 minutos sin responder en un chat activo.", vars: [],
      texto: "👋 ¿Sigues allí?\n\nCuando estés disponible, podemos retomar la conversación. ¡Estoy aquí para ayudarte! 😊" },
    { id: "7.3", cat: "Cierre y gestión de chat", titulo: "Cierre por inactividad (+1 hora)", usar: "El cliente no respondió, se intentó llamar y no se logró contacto.", vars: ["NOMBRE_CLIENTE"],
      texto: "Hola *[NOMBRE_CLIENTE]* 👋\n\nNo hemos podido establecer contacto contigo. Intentamos llamarte pero no pudimos comunicarnos.\n\nEstaremos atentos cuando desees retomar la conversación. Puedes escribirnos o comunicarte a nuestras líneas:\n\n📞 Manizales: 3116097675\n📞 Armenia: 3148144259\n📞 Pereira: 3206320999\n\n¡Que tenga un excelente día! 🚗" },

    { id: "8.1", cat: "Comercial / Leads", titulo: "Primer contacto lead", usar: "Se contacta por primera vez a un lead que dejó sus datos en redes sociales.", vars: ["NOMBRE","NOMBRE_ASESOR","MARCA/MODELO"],
      texto: "¡Hola *[NOMBRE]*! 👋\n\nSoy *[NOMBRE_ASESOR]* de Armotor. Gracias por tu interés en *[MARCA/MODELO]*.\n\nTenemos excelentes opciones disponibles para ti. ¿Te gustaría que te cuente más sobre las promociones actuales y opciones de financiación? 💰\n\nEstoy aquí para ayudarte a encontrar tu carro ideal. 😊" },
    { id: "8.2", cat: "Comercial / Leads", titulo: "Invitar a vitrina / prueba de manejo", usar: "El lead ya mostró interés y se quiere llevar a la sede.", vars: ["MODELO","CIUDAD","DIRECCIÓN"],
      texto: "Me encantaría que conocieras el *[MODELO]* en persona. Es muy diferente verlo en fotos que sentarte en él. 🚗\n\n📍 Te invito a nuestra sede en *[CIUDAD]*:\n*[DIRECCIÓN]*\n\n¿Qué día te queda cómodo para visitarnos? Puedo reservarte un espacio para que hagas *prueba de manejo*. 🔑\n\n*¡Sin compromiso, solo ven a conocerlo!*" },
    { id: "8.3", cat: "Comercial / Leads", titulo: "Información de financiación", usar: "El lead pregunta por formas de pago o financiación.", vars: ["MODELO"],
      texto: "Te cuento las opciones de financiación para el *[MODELO]*:\n\n💳 Financiación hasta *84 meses*\n📉 Tasas competitivas\n✅ Respuesta rápida de los bancos\n🎁 Promociones especiales este mes\n\nPara darte una cotización personalizada, ¿me confirmas:\n• Cuota inicial aproximada\n• Plazo preferido (36, 48, 60, 72 meses)\n\n¡Te armo varias opciones! 📊" },
    { id: "8.4", cat: "Comercial / Leads", titulo: "Vehículos usados certificados", usar: "El lead está interesado en usados.", vars: ["NOMBRE"],
      texto: "¡Hola *[NOMBRE]*! 👋\n\nGracias por tu interés en nuestros *vehículos usados certificados*. 🚙\n\nEn Armotor todos nuestros usados pasan por:\n✅ Revisión técnica completa\n✅ Historial verificado\n✅ Garantía incluida\n✅ Financiación disponible\n\nCuéntame, ¿qué tipo de vehículo estás buscando? ¿Tienes algún modelo en mente o me cuentas tu presupuesto y te ayudo a encontrar opciones? 💰" }
  ],

  // =============================================================
  //  CALIFICADOR COMERCIAL (guion-comercial-calificador-integrado.md)
  // =============================================================
  calificador: {
    clasificaciones: [
      { id: "P1", nombre: "Alta prioridad",  rango: [70,100], color: "#e53935", accion: "Asignar con prioridad",        sistema: "SGC (KIA) o Quiter (Honda/FAW/Usados)" },
      { id: "P2", nombre: "Media prioridad", rango: [40,69],  color: "#ea580c", accion: "Asignar en plataforma",        sistema: "SGC o Quiter" },
      { id: "P3", nombre: "Baja prioridad",  rango: [10,39],  color: "#2563eb", accion: "Asignar como compra futura",   sistema: "SGC o Quiter" },
      { id: "P4", nombre: "No aplica",       rango: [0,9],    color: "#525252", accion: "NO asignar. Enviar info por WhatsApp", sistema: "—" }
    ],
    fases: [
      {
        n: 1, titulo: "Apertura y validación", tiempo: "30 seg", califica: "A. Intención real (máx 25 pts)",
        decir: [
          '"Buenos días/tardes, ¿hablo con [NOMBRE]?" (esperar confirmación)',
          '"Mucho gusto [NOMBRE], mi nombre es [ASESOR], lo llamo de Armotor [MARCA] en [CIUDAD]. Vimos que nos dejó sus datos en Facebook mostrando interés en [VEHÍCULO/PROMOCIÓN]. ¿Tiene un minutico para que conversemos?"',
          'Si dice NO: "¿Le puedo llamar más tarde hoy o prefiere mañana? ¿A qué hora le queda más cómodo?" (registrar para recontacto, no insistir)',
          'Si no recuerda: "A veces los formularios de Facebook se envían accidentalmente. ¿Estaría interesado en conocer sobre [VEHÍCULO]? Le cuento en un minuto."'
        ],
        grupo: "A",
        pills: [
          { id:"A1", label: "Recuerda y confirma interés", pts: 15, color: "ok" },
          { id:"A2", label: "Tiene modelo definido (+10, acumulable)", pts: 10, color: "in", acumulable: true },
          { id:"A0", label: "No recuerda / niega interés", pts: 0, color: "gray" }
        ]
      },
      {
        n: 2, titulo: "Necesidad y urgencia", tiempo: "90 seg", califica: "E. Urgencia de compra (máx 15 pts)",
        decir: [
          '"Cuénteme [NOMBRE], ¿qué tipo de vehículo está buscando? ¿Tiene algún modelo o marca en mente?" (registrar nuevo/usado, marca, modelo)',
          '"¿Este vehículo sería para uso personal, familiar o para trabajo?"',
          '"¿Para cuándo está pensando hacer el cambio? ¿Es algo para este mes o está mirando más a futuro?"',
          '"¿Actualmente tiene un vehículo? ¿Ha pensado en darlo como parte de pago?" (si tiene retoma → pill +5 acumulable en Capacidad Financiera)'
        ],
        grupo: "E",
        pills: [
          { id:"E15", label: "Menos de 30 días 🔥", pts: 15, color: "ok" },
          { id:"E10", label: "1 a 3 meses", pts: 10, color: "in" },
          { id:"E5",  label: "3 a 6 meses", pts: 5, color: "wr" },
          { id:"E0",  label: "Solo mirando / sin plazo", pts: 0, color: "gray" }
        ]
      },
      {
        n: 3, titulo: "Ubicación geográfica", tiempo: "20 seg", califica: "B. Ubicación (máx 15 pts)",
        decir: [
          '"¿Desde qué ciudad nos escribe? Tenemos sedes en Armenia, Pereira, Manizales, Cartago y La Dorada. ¿Cuál le queda más cómoda?"',
          'Si está fuera del Eje: "¿Estaría dispuesto a venir hasta alguna de nuestras sedes para el proceso de compra? Tenemos clientes que vienen de otras ciudades porque les ofrecemos muy buenas condiciones."',
          '⚠️ Error común: si el cliente está fuera de zona, confirmar EXPLÍCITAMENTE si está dispuesto a desplazarse (cambia de 0 a 5 pts).'
        ],
        grupo: "B",
        pills: [
          { id:"B15", label: "Eje Cafetero", pts: 15, color: "ok" },
          { id:"B10", label: "Municipios aledaños (<1 h)", pts: 10, color: "in" },
          { id:"B5",  label: "Otra zona, dispuesto a venir", pts: 5, color: "wr" },
          { id:"B0",  label: "No dispuesto a venir", pts: 0, color: "gray" }
        ]
      },
      {
        n: 4, titulo: "Capacidad financiera", tiempo: "90 seg", califica: "C. Capacidad financiera (máx 30 pts)",
        decir: [
          '"¿Ha mirado los precios de los modelos que le interesan? ¿Tiene un presupuesto en mente?"',
          '"¿Está pensando comprarlo de contado o le gustaría conocer opciones de financiación?"',
          'Si financiación: "¿Aproximadamente cuánto estaría dispuesto a dar de cuota inicial?" · "¿Es empleado, independiente o pensionado?" · "¿Cómo está su historial crediticio? ¿Ha consultado Datacrédito?"',
          '⚠️ Error común: NO leer requisitos del banco antes de calificar. Primero se califica, después se informa.'
        ],
        grupo: "C",
        pills: [
          { id:"C20", label: "Ingresos > 2 SMLV (demostrables)", pts: 20, color: "ok" },
          { id:"C10", label: "Ingresos 1.5 a 2 SMLV", pts: 10, color: "in" },
          { id:"C0",  label: "No declara / < 1.5 SMLV", pts: 0, color: "gray" },
          { id:"C5a", label: "+ Cuota inicial ≥ 10% (acumulable)", pts: 5, color: "in", acumulable: true },
          { id:"C5b", label: "+ Vehículo para retoma (acumulable)", pts: 5, color: "in", acumulable: true }
        ]
      },
      {
        n: 5, titulo: "Perfil crediticio", tiempo: "—", califica: "D. Perfil crediticio (máx 15 pts)",
        decir: [
          'Subfase dentro de la misma conversación financiera, no es una fase separada.'
        ],
        grupo: "D",
        pills: [
          { id:"D15", label: "Sin reporte / buen historial", pts: 15, color: "ok" },
          { id:"D8",  label: "Reportado, deuda saldada (Ley Borrón)", pts: 8, color: "in" },
          { id:"D3",  label: "Reportado, deuda vigente, dispuesto", pts: 3, color: "wr" },
          { id:"D0",  label: "Reportado sin solución clara", pts: 0, color: "gray" }
        ]
      }
    ],
    cierre: {
      asignar: '"Excelente [NOMBRE], con lo que me comenta usted califica para que uno de nuestros asesores comerciales lo contacte y le presente las mejores opciones. ¿Le parece bien si le paso sus datos para que lo llame?" → Asignar en SGC (KIA) o Quiter (Honda/FAW/Usados). Copiar el resumen del calificador como observación.',
      noAsignar: '"Gracias [NOMBRE] por su tiempo. Le voy a enviar información por WhatsApp para que la revise con calma. Cualquier duda me puede escribir. ¡Que tenga buen día!" → NO asignar. Enviar plantilla WhatsApp. Registrar como P4.'
    },
    objeciones: [
      { q: '"Solo estaba mirando"', a: '"Totalmente entendible. Justamente para eso tenemos asesores que pueden darle toda la información sin compromiso. Solo necesito hacerle unas preguntas rápidas para conectarlo con el asesor indicado. ¿Me permite?"' },
      { q: '"Estoy reportado en centrales"', a: '"Gracias por comentármelo. Trabajamos con diferentes entidades que tienen opciones para diferentes perfiles. ¿La deuda ya está saldada o sigue vigente?"' },
      { q: '"No tengo cuota inicial"', a: '"Entiendo. Algunos de nuestros aliados manejan financiación hasta del 100%. ¿Me cuenta un poco sobre su situación laboral para ver qué opciones le podríamos ofrecer?"' },
      { q: '"Dígame el precio por teléfono"', a: '"Con gusto le doy un rango: el [MODELO] arranca desde [PRECIO_BASE]. El precio exacto depende de versión y accesorios. Para una cotización precisa, ¿me permite unas preguntas rápidas?"' },
      { q: '"Ya estoy hablando con otro concesionario"', a: '"Excelente que esté cotizando. Tenemos condiciones muy competitivas. ¿Me permite unas preguntas para ver si le ofrecemos algo mejor?"' },
      { q: '"Llámeme después / Estoy ocupado"', a: '"Por supuesto. ¿A qué hora le queda más cómodo? ¿Prefiere hoy más tarde o mañana?" (registrar hora exacta, no asumir «más tarde»)' },
      { q: '"Estoy muy lejos / No soy del Eje"', a: '"Entiendo. ¿Estaría dispuesto a venir hasta alguna de nuestras sedes? Tenemos clientes que vienen de otras ciudades porque les ofrecemos muy buenas condiciones."' }
    ],
    sistemas: [
      { marca: "KIA",    sistema: "SGC",    accion: "Asignar lead con resumen" },
      { marca: "Honda",  sistema: "Quiter", accion: "Asignar lead con resumen" },
      { marca: "FAW",    sistema: "Quiter", accion: "Asignar lead con resumen" },
      { marca: "Usados", sistema: "Quiter", accion: "Asignar lead con resumen" }
    ]
  },

  // =============================================================
  //  SEDES (base-conocimiento-completa.md · 1.1)
  // =============================================================
  // ===== ASESORES DE SERVICIO POR CIUDAD (select dependiente del panel) =====
  // Lista curada que alimenta el campo "Asesor servicio (taller)" del panel de
  // cierre, filtrada por la ciudad seleccionada. Editable desde Configuración
  // (coordinador). Manizales agrupa Alto Tablazo + Santander.
  asesoresServicio: {
    "Pereira":   ["Daniela María Marín", "Luis Felipe Giraldo"],
    "Manizales": ["Lina Clemencia López"],
    "Armenia":   ["Sergio Alexander Marín"],
    "Cartago":   ["Kimberly Ramírez"],
    "La Dorada": ["Jonathan Sánchez"]
  },

  sedes: [
    {
      nombre: "Pereira", marcas: ["KIA","Honda","FAW","Usados"],
      direccion: "Av. 30 de Agosto No. 93-41, Sector la Villa (diagonal Hospital Mental, cerca al Aeropuerto)",
      maps: "https://maps.app.goo.gl/Npw2My28NEPERB1SA",
      horarioTaller: "L-V 7:30am–5:30pm | Sáb 9:00am–1:00pm",
      horarioVitrina: "L-V 8:00am–6:00pm | Sáb 9:00am–1:00pm",
      contactos: [
        { nombre: "Daniela María Marín", area: "Asesor Servicio KIA", ext: "1445", cel: "3105084154" },
        { nombre: "Luis Felipe Giraldo", area: "Asesor Servicio KIA", ext: "30", cel: "3105013918" },
        { nombre: "Nydia Medina", area: "Accesorios", ext: "103", cel: "3206320999" },
        { nombre: "José Manuel Alzate", area: "Honda", ext: "1028", cel: "" },
        { nombre: "Wilson Alejandro Largo", area: "Colisión", ext: "930", cel: "" }
      ]
    },
    {
      nombre: "Armenia", marcas: ["KIA","Honda","Usados"],
      direccion: "Av Bolívar Cra. 14 No. 28 Norte – 60",
      maps: "https://maps.app.goo.gl/Ussv7uiPsACVmxt47",
      horarioTaller: "L-V 7:30am–5:30pm | Sáb 9:00am–1:00pm | NF 9:00am–1:00pm",
      horarioVitrina: "",
      contactos: [
        { nombre: "Sergio Alexander Marin Alvarez", area: "KIA", ext: "301", cel: "3148144259" },
        { nombre: "Diego Alexander Reyes Bernal", area: "Honda / Colisión", ext: "905", cel: "3147907921" },
        { nombre: "Nelly Forero", area: "Accesorios", ext: "318", cel: "" }
      ]
    },
    {
      nombre: "Manizales — Alto Tablazo", marcas: ["KIA","Honda"],
      direccion: "Vereda Alto Tablazo, bodega 1 (antigua bodega Nicole)",
      maps: "https://maps.app.goo.gl/coKhaiCLfa7pbKjGA",
      horarioTaller: "L-V 7:30am–5:30pm | Sáb 8:00am–12:00pm",
      horarioVitrina: "",
      nota: "Taller principal: completo, alineación y balanceo, especializada.",
      contactos: [
        { nombre: "Lina Clemencia López", area: "Asesor KIA", ext: "335", cel: "3116097675" },
        { nombre: "Maribel Rodriguez", area: "Colisión", ext: "944 → 1029", cel: "" },
        { nombre: "Mónica Girón", area: "Ópticos", ext: "918", cel: "" }
      ]
    },
    {
      nombre: "Manizales — Santander", marcas: ["KIA"],
      direccion: "Cra. 23 No. 35A-11",
      maps: "https://maps.app.goo.gl/ZBL6j3gCWNEXsSYc6",
      horarioTaller: "8:00am–12:00pm, 2:00pm–6:00pm | Sáb 9:00am–1:00pm",
      horarioVitrina: "",
      nota: "Vitrina + mecánica básica. Si requiere alineación/balanceo o especializada, con autorización del cliente se baja el vehículo al Alto Tablazo y se devuelve a la Santander.",
      contactos: [
        { nombre: "Mónica Uribe", area: "Repuestos", ext: "", cel: "3113863044" }
      ]
    },
    {
      nombre: "Cartago", marcas: ["KIA","Usados"],
      direccion: "Cra. 5 # 15-35 (una cuadra de la catedral)",
      maps: "",
      horarioTaller: "L-V 7:30am–12:00pm, 2:00pm–5:30pm | Sáb 9:00am–12:00pm",
      horarioVitrina: "",
      contactos: [ { nombre: "Kimberly Ramírez", area: "", ext: "419", cel: "" } ]
    },
    {
      nombre: "La Dorada", marcas: ["KIA","Usados"],
      direccion: "Cra. 2 No. 21-09 Esquina",
      maps: "",
      horarioTaller: "L-V 8:00am–12:00pm, 2:00pm–6:00pm",
      horarioVitrina: "",
      contactos: [ { nombre: "Jonathan Sánchez", area: "", ext: "846", cel: "" } ]
    }
  ],

  // ===== CONTACTOS DE ESCALAMIENTO (BdC 1.2) =====
  escalamiento: [
    { grupo: "Gerentes y Directores", items: [
      { cargo: "Gerente Comercial Armenia", nombre: "Carlos Ramírez", tel: "314 790 79 23", email: "" },
      { cargo: "Director Experiencia CX", nombre: "Pablo Andrey Rincón", tel: "325 109 19 08", email: "directorcx@armotor.com" },
      { cargo: "Gerente Usados", nombre: "Mauricio Martínez Patiño", tel: "314 823 03 32", email: "" },
      { cargo: "Gerente Honda Pereira", nombre: "Mateo Arango", tel: "314 827 45 44", email: "" }
    ]},
    { grupo: "Jefes de Taller y Líderes Posventa", items: [
      { cargo: "Jefe Taller Pereira", nombre: "Gustavo Adolfo Muriel", tel: "311 863 84 71", email: "" },
      { cargo: "Líder Posventa Pereira", nombre: "Jorge Andrés Ramírez", tel: "311 746 29 07", email: "" },
      { cargo: "Director Posventa Pereira", nombre: "Jhon Cardona", tel: "312 757 62 84", email: "" },
      { cargo: "Jefe Taller Manizales", nombre: "Juan Felipe Restrepo", tel: "311 386 30 64", email: "" },
      { cargo: "Líder Posventa Manizales", nombre: "César Augusto Sánchez", tel: "320 688 88 40", email: "" },
      { cargo: "Líder Colisión Manizales", nombre: "Verónica Flórez Alzate", tel: "314 790 79 18", email: "" }
    ]},
    { grupo: "Servicios de apoyo", items: [
      { cargo: "Servicio al Cliente", nombre: "Denis Valencia", tel: "300 339 92 04", email: "servicioalcliente@armotor.com" },
      { cargo: "Contabilidad", nombre: "—", tel: "311 386 30 62", email: "" },
      { cargo: "Telemetría KIA (Rastreo)", nombre: "Tatiana", tel: "310 788 20 97", email: "" },
      { cargo: "Líder Comercial Posventa", nombre: "Martha Elena Salazar", tel: "315 916 53 55", email: "" },
      { cargo: "Garantías Pereira", nombre: "Natalia Castaño", tel: "311 386 30 48", email: "" },
      { cargo: "Accesorios General", nombre: "—", tel: "311 386 30 44", email: "" }
    ]}
  ],

  // ===== EXTENSIONES EQUIPO CETA (BdC 1.3) =====
  extensiones: [
    { nombre: "Johana (Mille Johana Betancurth)", ext: "412", rol: "Asesor Call Center" },
    { nombre: "Juan Manuel (Londoño)", ext: "417", rol: "Asesor Call Center" },
    { nombre: "Paula (Paula Andrea Arévalo)", ext: "410", rol: "Asesor Digital" },
    { nombre: "Nata (Natalia Vargas)", ext: "411", rol: "Asesor Digital" },
    { nombre: "Aleja (Alejandra Tabares)", ext: "413", rol: "Asesor Call Center" },
    { nombre: "Juan Villa (Juan Diego)", ext: "415", rol: "Asesor Call Center" },
    { nombre: "Julio Pineda", ext: "414", rol: "Asesor Call Center" }
  ],

  // ===== CLIENTES VIP (BdC 1.4) =====
  vip: [
    { nombre: "Ana María Zuleta Picaño", placa: "LRU435", nota: "", tel: "321 793 03 18" },
    { nombre: "Alejandro Mesa Franco", placa: "LP5691", nota: "Honda", tel: "311 746 54 18" },
    { nombre: "Sandra Ybulla (Buitrago)", placa: "LPR792", nota: "Honda → Pereira", tel: "314 939 15 32" },
    { nombre: "Sandra Quintero", placa: "", nota: "Personal Morillo Teresa, Pereira", tel: "311 383 61 49 / 310 432 91 21" },
    { nombre: "Claudia María Sánchez Gallego", placa: "NAU638", nota: "Renault → Cartago Gerente", tel: "320 994 75 23" },
    { nombre: "Carlos Alberto Ramírez Montoya", placa: "JP2341", nota: "Armenia Nissan", tel: "314 790 71 23 / 310 301 68 08" },
    { nombre: "Johan Sebastián Mora Río", placa: "DOZ494", nota: "Cartago", tel: "312 248 72 29" },
    { nombre: "Liliana María Montes Mojita", placa: "LU5733", nota: "Mercadeo Ricardo", tel: "310 337 15 67" },
    { nombre: "Johan De Jesús Cardona Salazar", placa: "KMO592", nota: "Río", tel: "312 737 02 84" },
    { nombre: "Sandra Triviño", placa: "DKV401", nota: "", tel: "" },
    { nombre: "Lina Paola Agredo Leira", placa: "EFM911", nota: "", tel: "301 520 85 82" },
    { nombre: "Claudia Patricia Yepes Acevedo", placa: "LPV417", nota: "Picanto", tel: "" }
  ],

  // ===== PICO Y PLACA (BdC 1.5) =====
  picoPlaca: {
    Pereira: { horario: "6:00am a 8:00am", dias: { Lunes: "0-1", Martes: "2-3", Miércoles: "4-5", Jueves: "6-7", Viernes: "8-9" }, noAplica: "Sábados, domingos y festivos" },
    Armenia: { horario: "7:00–9:00am | 11:30am–2:00pm | 5:10–7:00pm", dias: { Lunes: "5-6", Martes: "7-8", Miércoles: "9-0", Jueves: "1-2", Viernes: "3-4" }, noAplica: "Domingos y festivos" },
    Manizales: null // PENDIENTE: Pablo confirma si hay pico y placa vigente
  },

  // ===== COBERTURA WE GO (BdC 2.2) =====
  coberturaWeGo: {
    Pereira: { zona: "Zona urbana de Pereira", quien: "Alfred" },
    Manizales: { zona: "Zona urbana", quien: "Alfred / Taller Manizales" },
    Armenia: { zona: "Zona urbana", quien: "Alfred / Taller Armenia" }
    // PENDIENTE: Pablo adjunta mapa de cobertura Alfred con zonas exactas
  },

  // ===== CAMPAÑAS ACTIVAS =====
  campanias: [
    { id: "seguridad-kia", titulo: "Campaña Seguridad KIA", vigente: true, permanente: true,
      resumen: "Intervenciones gratuitas y preventivas emitidas por Metrokia/SIC (CI_C_Kia_008_2026). Obligatorio contactar a toda la base y registrar resultado.",
      link: "https://kia.com.co/campanas-de-seguridad", guion: "Outbound → Campaña Seguridad KIA" },
    { id: "total-confianza", titulo: "Total Confianza KIA", vigente: true, desde: "2026-05-19", hasta: "2026-08-31",
      resumen: "Recuperación de clientes con +600 días, con lubricantes Total. Modelos: Picanto, K3, Soluto, Rio (5W30). Meta: 200 prospectos. Requiere OT, foto con banner Total Energies y aceptación del cliente para el recobro a Metrokia.",
      guion: "Outbound → Total Confianza KIA" },
    { id: "honda", titulo: "Campañas Honda", vigente: false, resumen: "PENDIENTE — Pablo define beneficio de recuperación Honda." },
    { id: "faw", titulo: "Campañas FAW", vigente: false, resumen: "PENDIENTE — Pablo define beneficio de recuperación FAW." }
  ],

  // =============================================================
  //  BASE DE CONOCIMIENTO — fichas (omnibox + vistas Productos/Operativo)
  // =============================================================
  conocimiento: [
    // 🔴 CRÍTICO
    { id: "descuentos", cat: "critico", badge: "red", titulo: "Descuentos y Beneficios Especiales", tags: ["descuento","junta directiva","beneficio","promoción"],
      resumen: "Junta Directiva: 30% mano de obra, 15% repuestos. Estándar: 5% para recurrentes (3+ visitas).",
      contenido: "Descuentos Junta Directiva: 30% en mano de obra, 15% en repuestos (solo miembros de Junta Directiva). Descuentos estándar autorizados: 5% para clientes recurrentes (3+ visitas). Cualquier descuento mayor requiere autorización del Líder de Posventa." },
    { id: "religioso-viaje", cat: "critico", badge: "red", titulo: "Religioso de Viaje", tags: ["viaje","inspección","religioso","revisión rápida","checklist"],
      resumen: "Inspección rápida para clientes que van a viajar. Precio: $10.000.",
      contenido: "Precio: $10.000. Inspección rápida para clientes que van a viajar. Incluye: taxeo de suspensión, revisión de frenos, niveles (líquidos), inspección de manitas, inspección de batería, inspección de luces, embriado de luces, sondeo, revisión de plumillas, inspección de tipos de aire." },
    // 🟡 PRODUCTOS
    { id: "telemetria", cat: "productos", badge: "gold", titulo: "Telemetría KIA", tags: ["telemetría","GPS","rastreo","seguridad","KIA","robo","monitoreo"],
      resumen: "GPS de KIA con geolocalización, apagado remoto y central de monitoreo 24h. $1.200.000/año con beneficio de marca.",
      contenido: "Servicio de rastreo vehicular de KIA mediante GPS instalado.\n\nBeneficios: 1) Geolocalización en tiempo real desde el celular. 2) Apagado remoto del motor en caso de robo. 3) Central de monitoreo 24 horas. 4) Alertas de velocidad configurables. 5) Geocerca (notificación si sale de una zona). 6) Botón SOS de emergencia.\n\nPrecio: valor lista $1.400.000/año; con beneficio de marca $1.200.000/año. Pago anual único, no mensual.\n\nA quién se ofrece: solo vehículos KIA, en el paso 9 del Inbound (al cierre) y en Outbound Advance. Aplica a vehículos nuevos y usados de la marca.\n\nModelos con hardware preinstalado: algunos modelos nuevos ya traen el GPS de fábrica; solo se activa el servicio. Verificar VIN con Tatiana (310 788 20 97).\n\nContacto técnico: Tatiana — 310 788 20 97." },
    { id: "wego", cat: "productos", badge: "gold", titulo: "We Go (recogida en casa)", tags: ["we go","recogida","domicilio","alfred","casa","transporte"],
      resumen: "Recogida del vehículo en casa, mantenimiento y devolución. SIN COSTO (permanente desde mayo 2026).",
      contenido: "Armotor recoge el vehículo en el domicilio, hace el mantenimiento y lo devuelve. El cliente no se desplaza.\n\nPrecio: SIN COSTO (política permanente desde mayo 2026), beneficio para quienes hacen mantenimiento con Armotor.\n\nCondiciones: solo aplica a mantenimientos SIN novedad. Si reporta síntomas (sonidos, vibraciones, fallas) NO se ofrece, porque el técnico necesita prueba de ruta con el cliente. Cobertura: zona urbana de Pereira, Manizales y Armenia.\n\nQuién recoge: Pereira → Alfred. Manizales → Alfred/Taller Manizales. Armenia → Alfred/Taller Armenia.\n\nDatos que se capturan: placa, fecha, hora, dirección, marca, línea, nombre, teléfono, ciudad, quién recoge, trayectos (1=ida, 2=ida y vuelta)." },
    { id: "garantia-honda", cat: "productos", badge: "gold", titulo: "Garantías Honda", tags: ["garantía","honda","cobertura","exclusión","modelo","vigencia"],
      resumen: "Total (Pilot, CR-V, Civic, Accord): 2 años/100.000 km. WR-V, City: 5 años/120.000 km.",
      contenido: "Modelos con Garantía Total (Pilot, CR-V, Civic, Accord): 2 años / 100.000 km (compras hasta 28 feb 2025 y desde 1 mar 2025).\n\nOtros modelos: WR-V, City → 5 años/120.000 km, RV 2 años/40.000 km. HR-V, ZR-V (hasta 28 feb) → 3 años/100.000 km, RV 2 años. HR-V, ZR-V (desde 1 mar) → 5 años/120.000 km, RV 2 años.\n\nLa Garantía Total NO cubre: cambio aceite motor, aceite transmisión, filtro aire motor, plumillas, gomas, líquido de frenos, pastillas de frenos, bomba dual, poder A/A." },
    { id: "garantia-kia", cat: "productos", badge: "gold", titulo: "Garantías KIA", tags: ["garantía","KIA","cobertura","extensión","7 años","150000 km"],
      resumen: "Diferencial Armotor: garantía extendida hasta 7 años / 150.000 km (verificar condiciones).",
      contenido: "Garantía de fábrica según modelo (consultar con asesor de garantías). Diferencial Armotor: garantía extendida hasta 7 años / 150.000 km (verificar condiciones con el concesionario).\n\nPara mantener la garantía vigente: realizar TODOS los mantenimientos en la red autorizada KIA, respetar los intervalos de km o tiempo (lo primero que se cumpla), cada servicio queda en el historial oficial.\n\nContacto garantías: Natalia Castaño — Pereira — 311 386 30 48." },
    { id: "garantia-faw", cat: "productos", badge: "gold", titulo: "Garantías FAW", tags: ["garantía","FAW","cobertura"],
      resumen: "PENDIENTE — Pablo define cobertura y condiciones de garantía FAW.",
      contenido: "PENDIENTE: Pablo debe definir cobertura y condiciones de garantía FAW para incluir en la base." },
    { id: "kit-service", cat: "productos", badge: "gold", titulo: "Kit Service Sportage Híbrida Diésel", tags: ["kit service","sportage","híbrida","diésel","metrokia"],
      resumen: "Apoyo económico de Metrokia para Sportage Híbrida Diésel recurrentes con mantenimientos al día (vigencia Total Confianza).",
      contenido: "Metrokia ofrece un apoyo económico adicional (KIT-SERVICE) para atender mensualmente unidades Sportage Híbrida Diésel que sean clientes recurrentes y tengan todos sus mantenimientos al día. Aplica durante la vigencia de la campaña Total Confianza KIA (mayo–agosto 2026)." },
    // 🟢 OPERATIVO
    { id: "tablas-mtto", cat: "operativo", badge: "green", titulo: "Tablas de Mantenimiento", tags: ["mantenimiento","tabla","kilometraje","servicio","gasolina","diésel","híbrido","eléctrico"],
      resumen: "Consulta por Marca → Combustión → Modelo → Km. El Cotizador del panel consume esta data.",
      contenido: "Se consulta por: Marca → Combustión → Modelo → Kilometraje. La data viene de los manuales oficiales (5 PDFs).\n\nCombustión / manual / modelos: Gasolina (manual_gasolina_12_abril_25) → Picanto, Soluto, Rio, K3, Sportage, Carens. Diésel → Sportage Diésel, Sorento. Híbrido → Sportage HEV, Niro. Eléctrico → EV6, Niro EV. Stonic Híbrido → Stonic HEV.\n\nRegla: el mantenimiento se programa por kilometraje O por tiempo, lo primero que se cumpla.\n\nNO incluye (siempre aclarar): filtro de aire de motor, filtro de aire A/C, cauchos de plumillas (sujetos a inspección, se cotizan aparte). Lavado incluido: enjuague exterior + aspirado (básico); combos de embellecimiento aparte." },
    { id: "check-engine", cat: "operativo", badge: "green", titulo: "Manejo de Check Engine", tags: ["check engine","testigo","luz","tablero","motor","escalar"],
      resumen: "No recomendar grúa sin validar. Pedir foto del tablero y escalar al Líder de Posventa.",
      contenido: "Protocolo: 1) NO recomendar traer en grúa sin validar primero. 2) Pedir foto del tablero. 3) Escalar al Líder de Posventa con la imagen. 4) Esperar instrucciones antes de responder.\n\nRespuesta mientras se escala: «Para darle la mejor orientación sobre el testigo que presenta su vehículo, permítame validar con nuestro equipo técnico. En unos minutos le confirmo las recomendaciones.»" },
    { id: "grua", cat: "operativo", badge: "green", titulo: "¿Cuándo necesita grúa?", tags: ["grúa","remolque","emergencia","no enciende"],
      resumen: "Solo con autorización del Líder de Posventa. Criterios: no enciende, pérdida de potencia, ruido metálico, temperatura en rojo, fuga.",
      contenido: "Criterios (solo con autorización del Líder de Posventa): vehículo no enciende, pérdida de potencia severa, ruidos metálicos fuertes en motor, testigo de temperatura en rojo, fuga visible de aceite o líquidos.\n\nRespuesta (después de validar): «Por los síntomas que me describe, le recomiendo traerlo en grúa por prevención, ya que si sigue andando así podría afectar otros componentes. ¿Tiene servicio de grúa de su seguro o desea que le proporcionemos un contacto?»" },
    { id: "revision-5000", cat: "operativo", badge: "green", titulo: "Revisión 5.000 km KIA (ya no disponible)", tags: ["5000","inspección","primera revisión","KIA"],
      resumen: "Ya no la realiza la marca. No afecta la garantía. Las revisiones empiezan a los 10.000 km o 12 meses.",
      contenido: "«Le comento que esta inspección lamentablemente ya no la está realizando la marca. No se preocupe, no afecta en nada la garantía. Las revisiones empiezan a los 10.000 km o 12 meses desde la compra, lo primero que ocurra. ¿Desea que le agende un recordatorio para cuando se acerque?»" },
    { id: "documentos", cat: "operativo", badge: "green", titulo: "Documentos que debe llevar el cliente", tags: ["documentos","llevar","tarjeta","manual","pernos","soat"],
      resumen: "Tarjeta de propiedad, manual de garantías, llave de pernos. Para We Go: + SOAT y tecnomecánica vigentes.",
      contenido: "Para cualquier visita al taller: tarjeta de propiedad, manual de garantías, llave de pernos (si tiene). Adicional para servicio We Go: SOAT vigente y tecnomecánica vigente." },
    { id: "casos-especiales", cat: "operativo", badge: "green", titulo: "Casos Especiales", tags: ["especial","festivo","we go no aplica","síntoma","cliente molesto"],
      resumen: "We Go no aplica con síntomas; manejo de día festivo; protocolo de cliente molesto.",
      contenido: "We Go no aplica (con síntomas): «Para este tipo de intervenciones donde se requiere diagnóstico, no realizamos la recogida We Go. Necesitamos que el técnico haga una prueba de ruta junto con usted. Le recomiendo traerlo directamente al taller.»\n\nDía festivo: «Este [DÍA] es festivo y nuestros talleres no laboran. ¿Verifico disponibilidad para el [SIGUIENTE DÍA HÁBIL]?»\n\nCliente molesto: 1) Escuchar sin interrumpir. 2) Validar el sentimiento: «Entiendo su molestia, tiene toda la razón en expresarla.» 3) Nunca discutir. 4) Ofrecer solución o escalar: «Permítame tomar sus datos para escalar su caso con mi coordinador y darle una solución a la mayor brevedad.»" }
  ]
};
