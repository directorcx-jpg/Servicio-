# Brief Técnico — Consola CETA Armotor
## Para implementación en Claude Code

> **Repositorio:** directorcx-jpg/Servicio-
> **Hosting:** GitHub Pages
> **Archivo actual a reemplazar:** protocolo-atencion-armotor.html
> **Owner:** Pablo Andrey Rincón — Director CX Armotor
> **Fecha:** Mayo 2026

---

## 1. RESUMEN DEL PROYECTO

Rediseñar el portal de protocolos del call center CETA de Armotor, transformándolo de una página consultiva estática en una **Consola Operativa de Alta Productividad** que integra: guiones de atención, cotizador de mantenimientos, panel de cierre unificado (reemplaza 4 formularios de Google), tipificación automática, generación de tarjeta de servicio, y base de conocimiento buscable. Todo desplegado como SPA en GitHub Pages sin compilación.

---

## 2. ARQUITECTURA

```
GitHub Pages (archivos estáticos — ES Modules nativos)
├── index.html          ← Estructura HTML + CSS (design tokens propios, NO Tailwind)
│                         <script type="module" src="app.js">
├── app.js              ← import { DATA } from './data.js'
│                         Lógica, navegación, state reactivo, panel unificado
├── data.js             ← export { DATA }
│                         TODO el contenido (guiones, plantillas, contactos, cotizador, BdC)
└── assets/
    └── armotor-logo.svg

Google Apps Script (backend transaccional)
├── Endpoint POST /guardarGestion    ← Escribe en Sheet unificado
├── Endpoint GET /consultarCotizador ← Lee precios del Sheet cotizador
├── Endpoint GET /buscarPlaca        ← Busca cliente por placa en base
└── CacheService (6 min)             ← Cachea lecturas frecuentes

Google Sheets
├── CETA_Gestiones_2026              ← Sheet unificado (reemplaza 4 Forms)
├── Cotizador Armotor (existente)    ← Precios por marca/modelo/km
└── INTERNOS (existente)             ← Casos internos con asignación
```

**Patrón de módulos:** El HTML carga `app.js` como `<script type="module">`. `app.js` importa `DATA` desde `data.js`. No hay variables globales sueltas ni riesgo de colisión de nombres. Requiere servir desde un servidor (GitHub Pages o `npx serve .` en local), no se puede abrir con doble click.

**Patrón de fallback API:** Todas las llamadas a Apps Script usan `Promise.race` con un timeout de 3 segundos. Si la API no responde a tiempo, el portal usa los datos locales de `data.js` como respaldo inmediato. El asesor nunca se queda esperando. Se muestra un indicador sutil cuando se opera con datos locales.

**Principio clave:** datos de CONSULTA (cotizador, contactos, guiones) cacheados en `localStorage` del navegador. Datos TRANSACCIONALES (gestiones) escritos a Sheet vía Apps Script en background. El asesor percibe todo instantáneo.

### Patrón de Estado Reactivo (mejora v4)
El JavaScript usa un **objeto de estado global** (`S`) que almacena todos los datos capturados en tiempo real. Cada input/select actualiza `S` mediante `syncState()`. Todas las salidas (nota Quiter, Evolution, resumen cliente) se regeneran desde `S`, nunca leyendo directamente del DOM. Esto desacopla lógica de presentación y elimina bugs como leer `.value` en elementos `<div>`.

```javascript
const S = {
  resultado: 'agenda',
  hasNovedad: false,
  hasWG: false,
  adicionales: new Set(),
  checks: new Set([...]),
  f: {} // campos del formulario, sincronizados con data-f attributes
};
```

---

## 3. LAYOUT (3 columnas fijas, 100vh)

```
┌─ HEADER (52px) ─────────────────────────────────────────────┐
│ Logo ARMOTOR/CETA | Omnibox buscador (⌘K) | Theme | User   │
├─ SIDEBAR (220px) ─┬─ CENTRAL (flex) ─┬─ RIGHT PANEL (380px)─┤
│ Nav vertical       │ Guiones/BdC/Home │ Panel gestión unific.│
│ Scroll independ.   │ Scroll independ. │ Scroll independ.     │
├────────────────────┴──────────────────┴──────────────────────┤
│ FOOTER (26px) — versión · fecha · owner · estado             │
└──────────────────────────────────────────────────────────────┘
```

**Responsive:** en móvil, sidebar se oculta con hamburger. Panel derecho se mueve debajo del central. Central ocupa 100%.

---

## 4. SIDEBAR — ESTRUCTURA DE NAVEGACIÓN

```
GENERAL
├── Home Operativo

ATENCIÓN
├── Inbound Posventa (10 pasos, navegables con ← →)
├── Outbound (4 tipos: Advance, Recuperación, Seguridad, Total Confianza)
├── Lead Comercial (calificador integrado al guion)
├── Plantillas WhatsApp (25 plantillas, 8 categorías)

GESTIÓN
├── Casos Internos CETA (formulario + asignación)
├── Control de Gestión (vista coordinador, modo TV)

BASE DE CONOCIMIENTO
├── Productos y Servicios (Telemetría, We Go, Garantías)
├── Contactos y Sedes (70 corporativos + IVR, buscable)
├── Manuales Mantenimiento (consulta por marca/modelo/km)
├── Campañas Activas (Seguridad KIA, Total Confianza)
├── Operativo (Check Engine, Grúa, Pico Placa, Religioso Viaje)
├── Clientes VIP (badge dorado, siempre visible)
```

---

## 5. MAPA DE CONTENIDO — QUÉ DOCUMENTO ALIMENTA QUÉ MÓDULO

| Módulo del portal | Documento fuente | Ubicación |
|---|---|---|
| Tono y estilo global | `cx-armotor-tone.md` | Aplicar en toda redacción |
| Inbound Posventa | `flujo-inbound-posventa-10-pasos.md` | 10 fichas navegables |
| Outbound (4 tipos) | `guiones-outbound-completo.md` | 4 fichas con sub-perfiles |
| Plantillas WhatsApp | `plantillas-whatsapp-unificadas.md` | 25 plantillas en 8 categorías |
| Calificador + Comercial | `guion-comercial-calificador-integrado.md` | Guion 5 fases con pills |
| Panel de Cierre Unificado | `spec-panel-cierre-unificado.md` | Columna derecha completa |
| Base de Conocimiento | `base-conocimiento-completa.md` | Todas las fichas BdC |
| Mockup de referencia visual | `mockup-portal-ceta-v4.html` | Referencia de diseño (versión final) |

---

## 6. ESTRUCTURA DE data.js

```javascript
// data.js — ES Module
// Exporta todo el contenido como un único objeto DATA

export const DATA = {

  // ===== GUIONES INBOUND (10 pasos) =====
  inbound: [
    {
      paso: 1,
      titulo: "Apertura cálida",
      tiempo: "10 seg",
      validar: ["Tener sistema abierto", "Contestar antes del 3er timbre"],
      decir: '"Armotor, muy buenos días, le habla [NOMBRE_ASESOR]..."',
      hacer: ["Registrar nombre del cliente"],
      escalar: null,
      tips: ["No mencionar marca ni slogan en apertura"]
    },
    // ... pasos 2-10 (contenido completo en flujo-inbound-posventa-10-pasos.md)
  ],

  // ===== GUIONES OUTBOUND =====
  outbound: {
    advance: { titulo: "Advance (1er mantenimiento)", fases: [...] },
    recuperacionA: { titulo: "Recuperación 6-12 meses", fases: [...] },
    recuperacionB: { titulo: "Recuperación 12-24 meses", fases: [...] },
    recuperacionC: { titulo: "Recuperación +24 meses", fases: [...] },
    seguridadKIA: { titulo: "Campaña Seguridad KIA", fases: [...] },
    totalConfianza: { titulo: "Total Confianza KIA", vigencia: "19-may a 31-ago 2026", fases: [...] }
  },

  // ===== PLANTILLAS WHATSAPP (25) =====
  plantillas: [
    { id: "1.1", cat: "Saludos", titulo: "Saludo inicial", texto: "¡Hola! 👋 Mucho gusto...", vars: ["NOMBRE_ASESOR"] },
    // ... 24 plantillas más (contenido en plantillas-whatsapp-unificadas.md)
  ],

  // ===== CALIFICADOR LEADS =====
  calificador: {
    criterios: [
      { id: "A", nombre: "Intención real", max: 25, opciones: [
        { label: "Recuerda y confirma", pts: 15 },
        { label: "Tiene modelo definido", pts: 10, acumulable: true },
        { label: "No recuerda", pts: 0 }
      ]},
      // ... B, C, D, E (contenido en guion-comercial-calificador-integrado.md)
    ],
    clasificaciones: [
      { id: "P1", rango: [70,100], color: "#e53935", accion: "Asignar con prioridad" },
      { id: "P2", rango: [40,69], color: "#ea580c", accion: "Asignar en plataforma" },
      { id: "P3", rango: [10,39], color: "#2563eb", accion: "Asignar compra futura" },
      { id: "P4", rango: [0,9], color: "#525252", accion: "NO asignar" }
    ]
  },

  // ===== COTIZADOR =====
  // Opción A: data estática (requiere actualización manual)
  // Opción B: consultada vía Apps Script al Sheet (recomendada)
  cotizador: {
    endpoint: "https://script.google.com/macros/s/[DEPLOY_ID]/exec",
    // Fallback local:
    local: {
      "KIA-Gasolina-Picanto-10000": {
        precio: 1068978,
        incluye: ["Cambio aceite y filtro motor", "Diagnóstico KDS 2.0", ...],
        noIncluye: ["Filtro aire motor", "Filtro aire A/C", "Plumillas"]
      },
      // ... demás modelos (extraer de los 5 PDFs de manuales)
    }
  },

  // ===== TIPIFICADOR — Mapeo Evolution =====
  tipificador: {
    servicioSigno: {
      "MANTENIMIENTO": "++", "REVISIÓN": "*",
      "GARANTÍA": "??", "INSPECCIÓN": "", "ESPECIALIZADA": "??"
    },
    resultadoEvo: {
      "agenda": { estado: "CONTACTO", causa: "AGENDAMIENTO EXITOSO" },
      "seg": { estado: "CONTACTO", causa: "VOLVER A LLAMAR" },
      "noc": { estado: "NO CONTACTO", causa: "NO CONTESTA" },
      "noa": { estado: "CONTACTO", causa: "NO TIENE KILOMETRAJE" },
      "otro": { estado: "CONTACTO", causa: "VISITA OTRO TALLER" },
      "nov": { estado: "CONTACTO", causa: "NO VOLVER A CONTACTAR" }
    }
  },

  // ===== CONTACTOS CORPORATIVOS (70) =====
  contactos: [
    { nombre: "Carlos Ramírez", cargo: "Gerente Comercial Armenia", tel: "314 790 79 23", ciudad: "Armenia", area: "Comercial" },
    // ... 69 más (extraídos de NUMEROS.xlsx)
  ],

  // ===== EXTENSIONES IVR (35) =====
  extensiones: [
    { nombre: "Johana Betancurth", ext: "412", rol: "Asesor Call Center" },
    // ... (extraídos de Propuesta_IVR_Armotor.xlsx)
  ],

  // ===== SEDES =====
  sedes: [
    {
      nombre: "Pereira", marcas: ["KIA","Honda","FAW","Usados"],
      direccion: "Av. 30 de Agosto No. 93-41",
      maps: "https://maps.app.goo.gl/Npw2My28NEPERB1SA",
      horarioTaller: "L-V 7:30am-5:30pm | Sáb 9:00am-1:00pm",
      horarioVitrina: "L-V 8:00am-6:00pm | Sáb 9:00am-1:00pm",
      contactos: [
        { nombre: "Daniela María Marín", area: "Servicio KIA", ext: "1445", cel: "3105084154" },
        // ...
      ]
    },
    // Armenia, Manizales Tablazo, Manizales Santander, Cartago, La Dorada
  ],

  // ===== CLIENTES VIP =====
  vip: [
    { nombre: "Ana María Zuleta Picaño", placa: "LRU435", nota: "", tel: "321 793 03 18" },
    // ... 11 más (contenido en base-conocimiento-completa.md)
  ],

  // ===== PICO Y PLACA =====
  picoPlaca: {
    Pereira: { horario: "6:00am a 8:00am", dias: { Lunes: "0-1", Martes: "2-3", Miercoles: "4-5", Jueves: "6-7", Viernes: "8-9" }, noAplica: "Sáb, Dom, Festivos" },
    Armenia: { horario: "7:00-9:00am | 11:30am-2:00pm | 5:10-7:00pm", dias: { Lunes: "5-6", Martes: "7-8", Miercoles: "9-0", Jueves: "1-2", Viernes: "3-4" }, noAplica: "Dom, Festivos" },
    Manizales: null // No tiene pico y placa
  },

  // ===== BASE DE CONOCIMIENTO =====
  conocimiento: [
    { id: "telemetria", cat: "productos", badge: "gold", titulo: "Telemetría KIA", tags: ["GPS","rastreo","seguridad"], contenido: "..." },
    { id: "wego", cat: "productos", badge: "gold", titulo: "We Go (sin costo)", tags: ["recogida","domicilio","alfred"], contenido: "..." },
    // ... todos los artículos de base-conocimiento-completa.md
  ],

  // ===== COBERTURA WE GO =====
  coberturaWeGo: {
    Pereira: { zona: "Zona urbana Pereira + Dosquebradas", excluye: "Cerritos", nota: "Cubre: Vía Condina, Malabar, Galicia, Parque Industrial, Frailes, Romelia" },
    Manizales: { zona: "Zona urbana", excluye: "", nota: "" },
    Armenia: { zona: "Zona urbana", excluye: "", nota: "" }
  },

  // ===== CAMPAÑAS ACTIVAS =====
  campanias: [
    { id: "seguridad-kia", titulo: "Campaña Seguridad KIA", vigente: true, permanente: true },
    { id: "total-confianza", titulo: "Total Confianza KIA", vigente: true, desde: "2026-05-19", hasta: "2026-08-31" }
  ]
};
```

---

## 7. GOOGLE SHEET UNIFICADO — Estructura

**Nombre:** CETA_Gestiones_2026
**Columnas (40):** Ver especificación completa en `spec-panel-cierre-unificado.md` sección "Estructura del Google Sheet Unificado".

Resumen: Marca temporal (A) → Asesor (B) → Datos cliente (C-J) → Cotización (K-R) → Novedad (S-T) → We Go (U-Z) → Adicionales (AA-AD) → Resultado (AE-AI) → Nota Quiter (AJ) → Evolution (AK-AN).

---

## 8. APPS SCRIPT — Endpoints necesarios

### POST /guardarGestion
Recibe JSON con todos los campos del panel de cierre. Escribe una fila en CETA_Gestiones_2026. Retorna { success: true, row: N }.

### GET /consultarCotizador?marca=KIA&modelo=Picanto&km=10000
Lee el Sheet del cotizador existente. Retorna precio e ítems incluidos/excluidos. Usa CacheService (6 min) para no leer el sheet en cada petición.

### GET /buscarPlaca?placa=ABC123
Busca en la base de clientes. Retorna nombre, teléfono, modelo si existe. Para autocompletar datos.

### Publicación
Deploy como Web App: ejecutar como el usuario editor, acceso "Cualquiera". La URL del deploy se configura en data.js.

---

## 9. DESIGN TOKENS (extraídos del mockup v3)

### Colores
```
Modo claro: bg #fafaf9, panel #fff, subtle #f4f4f3, border #e7e5e4, text #1c1917
Modo oscuro: bg #0f0f10, panel #18181b, subtle #232328, border #2a2a30, text #f4f4f5
Accent (Armotor): #e53935 / hover #c62828
Success: #16a34a | Warning: #ea580c | Info: #2563eb | Gold: #b45309
```

### Tipografía
```
Display (títulos): Manrope 700/800
UI (body): Inter 400/500/600
Data (monospace): JetBrains Mono 400/500
```

### Componentes clave
- Pills tappables (border-radius: 16px, padding: 5px 10px)
- Cards con border-radius: 8px, border 1px solid var(--bd)
- Botones con padding generoso (ley de Fitts para uso bajo presión)
- Toggles para sí/no (32x18px)
- Fichas operativas: Validar → Decir (font +20%) → Hacer → Escalar
- Alerts: fondo sutil + borde izquierdo 3px + ícono semántico

### Componentes nuevos (v4)
- **Tabs de salidas:** 3 pestañas compactas (`Quiter/iVuo` | `Evolution` | `Cliente`) dentro del contenedor de salidas. Solo se ve una salida a la vez. El botón Guardar siempre visible sin scroll.
- **Semáforo de completitud:** indicador con punto rojo/amarillo/verde + mensaje dinámico. Rojo = "X campos pendientes", Amarillo = "Falta: [campos]", Verde = "Listo para guardar". El botón Guardar permanece `disabled` (gris, con `cursor:not-allowed`) hasta que el semáforo esté verde.
- **Adicionales split:** sección 6 dividida en dos sub-bloques visuales: "Para el cliente" (Telemetría, Accesorios con campo libre) y "Para el taller" (pills de validaciones: campaña, embellecimiento, adicionales, accesorios, qué más requiere, especializada, cotizar tapetes/rines).
- **Motivo del contacto:** select ligero después de datos del cliente con valor por defecto "— Se define en la llamada —". El asesor lo llena cuando el cliente le dice por qué llama (no antes).
- **Nomenclatura corregida:** resultado "No contactar" usa `noContactar` en el código; toggle de síntomas usa `novedad`. Sin colisión de IDs.
- **Funciones de copiado:** todas usan `.textContent` para leer de elementos `<div>`, nunca `.value` (que solo aplica a `<input>` y `<select>`).

---

## 10. FASES DE IMPLEMENTACIÓN

### Fase 1 — Estructura base (prioridad máxima)
1. Layout 3 columnas con sidebar, central y panel derecho
2. **Pantalla de login con selector + PIN de 4 dígitos**
3. **Sistema de roles:** filtrar vistas y permisos según `S.user.rol`
4. Navegación entre vistas (sidebar clicks)
5. Home Operativo como landing (stats filtradas por rol)
6. Modo oscuro/claro con persistencia
7. Omnibox de búsqueda global
8. Sistema de fichas operativas (Validar/Decir/Hacer/Escalar)

### Fase 2 — Panel de cierre unificado (corazón del sistema)
1. Las 6 secciones con visibilidad condicional por resultado
2. Cotizador integrado (con data local inicial)
3. Generación automática de las 3 salidas con **tabs** (Quiter | Evolution | Cliente)
4. **Semáforo de completitud** — botón Guardar deshabilitado hasta campos obligatorios llenos
5. **Split de adicionales** — "Para el cliente" vs "Para el taller"
6. **State object reactivo** — todas las salidas se generan desde `S`, no desde el DOM
7. Tarjeta de servicio descargable (html2canvas)
8. Botón guardar (POST a Apps Script)
9. **Motivo del contacto** — select post-datos, se llena durante la llamada

### Fase 3 — Contenido completo
1. Cargar los 10 pasos de Inbound en data.js
2. Cargar los 4 guiones de Outbound
3. Cargar las 25 plantillas WhatsApp
4. Cargar el calificador comercial con pills
5. Cargar toda la Base de Conocimiento (contactos, sedes, VIP, etc.)

### Fase 4 — Integraciones
1. Apps Script para guardar gestiones
2. Apps Script para consultar cotizador en vivo
3. Apps Script para buscar cliente por placa
4. Vista de control de gestión (coordinador)
5. Modo TV para pantalla

### Fase 5 — Módulo Internos CETA
1. Formulario de radicación de casos
2. Lógica de asignación (reglas pendientes de Pablo)
3. Verificación de duplicados
4. Vista de casos asignados por asesor

---

## 11. ARCHIVOS A ENTREGAR EN EL REPO

### 10.5 SISTEMA DE AUTENTICACIÓN Y PERMISOS

#### Login con PIN
Al abrir el portal aparece una pantalla de login sencilla:
1. Dropdown con los nombres del equipo CETA (9 personas)
2. Campo de PIN de 4 dígitos
3. Botón "Entrar"

Si el PIN es correcto, el portal carga con el rol correspondiente. Si es incorrecto, muestra "PIN incorrecto" y no deja entrar. La sesión se mantiene en `localStorage` hasta que el usuario cierre sesión o se borre caché.

#### Gestión de usuarios (solo coordinador)
El coordinador accede a una vista "Configuración → Usuarios" donde puede:
- Ver la lista de usuarios con su rol
- Cambiar el PIN de cualquier usuario
- Activar/desactivar usuarios (si alguien sale del equipo)
- Agregar nuevos usuarios con nombre, rol y PIN inicial

#### Almacenamiento de usuarios
Los usuarios se almacenan en el `data.js` inicialmente (para arranque rápido) y opcionalmente en un Google Sheet para gestión dinámica:

```javascript
usuarios: [
  { id: 1, nombre: "Pablo Andrey Rincón", alias: "Pablo R.", rol: "coordinador", pin: "****", activo: true },
  { id: 2, nombre: "Johana Betancurth", alias: "Johana", rol: "asesor_cc", pin: "****", activo: true },
  { id: 3, nombre: "Juan Diego Villa", alias: "Juan Villa", rol: "asesor_cc", pin: "****", activo: true },
  { id: 4, nombre: "Karen Julieth Corchuelo", alias: "Karen", rol: "asesor_cc", pin: "****", activo: true },
  { id: 5, nombre: "Alejandra Tabares", alias: "Aleja", rol: "asesor_cc", pin: "****", activo: true },
  { id: 6, nombre: "Julio Pineda", alias: "Julio", rol: "asesor_cc", pin: "****", activo: true },
  { id: 7, nombre: "Paula Andrea Arévalo", alias: "Paula", rol: "asesor_digital", pin: "****", activo: true },
  { id: 8, nombre: "Natalia Vargas", alias: "Nata", rol: "asesor_digital", pin: "****", activo: true },
  { id: 9, nombre: "Analista", alias: "Analista", rol: "analista", pin: "****", activo: true }
]
```

#### Roles y permisos

| Funcionalidad | coordinador | analista | asesor_cc | asesor_digital |
|---|:---:|:---:|:---:|:---:|
| Home stats equipo completo | ✅ | ✅ | Solo propias | Solo propias |
| Guiones, plantillas, BdC | ✅ | ✅ | ✅ | ✅ |
| Panel de cierre (registrar) | ✅ | Solo lectura | ✅ | ✅ |
| Ver mis casos | Todos | Todos | Solo propios | Solo propios |
| Control gestión (filtros) | ✅ | ✅ | Solo propios | Solo propios |
| Modo TV | ✅ | ✅ | ❌ | ❌ |
| Reasignar casos | ✅ | ❌ | ❌ | ❌ |
| Editar plantillas y guiones | ✅ | ❌ | ❌ | ❌ |
| Configuración (usuarios, PINs) | ✅ | ❌ | ❌ | ❌ |
| Módulo Internos (asignar) | ✅ | ❌ | Ver asignados | ❌ |
| Exportar reportes | ✅ | ✅ | ❌ | ❌ |

#### Implementación del filtro por rol
Cuando el usuario entra, se guarda `S.user` con su id, nombre, alias y rol. Todas las vistas consultan `S.user.rol` para:
- Mostrar/ocultar elementos del sidebar (ej: "Configuración" solo para coordinador)
- Filtrar datos en Control de Gestión (`WHERE asesor = S.user.alias` para roles no-coordinador)
- Deshabilitar botones que no corresponden al rol
- Precargar el nombre del asesor en el panel de cierre sin que lo escriba

```
Servicio-/
├── index.html                              ← Portal completo (SPA)
├── app.js                                  ← Lógica (state object reactivo, navegación, validación)
├── data.js                                 ← Contenido
├── docs/
│   ├── cx-armotor-tone.md                  ← Skill de tono (para Claude)
│   ├── flujo-inbound-posventa-10-pasos.md  ← Referencia contenido
│   ├── guiones-outbound-completo.md
│   ├── plantillas-whatsapp-unificadas.md
│   ├── guion-comercial-calificador-integrado.md
│   ├── spec-panel-cierre-unificado.md
│   └── base-conocimiento-completa.md
├── mockups/
│   ├── mockup-portal-ceta-v4.html          ← Referencia visual FINAL (panel unificado + Home)
│   └── mockup-portal-ceta-v2.html          ← Referencia visual (Home original + cotizador detallado)
├── apps-script/
│   └── Code.gs                             ← Apps Script para deploy
└── README.md
```

---

## 12. PENDIENTES QUE PABLO DEBE PROVEER

| Ítem | Para qué se necesita | Prioridad |
|------|---------------------|:---------:|
| Reglas asignación módulo Internos CETA | Fase 5: cómo se asignan casos entre asesores | Alta |
| Data completa de mantenimientos (todos modelos × km × precio) | Fase 3: alimentar cotizador con datos reales | Alta |
| **Asignar PINs de 4 dígitos a cada usuario** | Fase 1: login funcional (coordinador los define) | Alta |
| Beneficio recuperación Honda | Guion outbound Honda | Media |
| Beneficio recuperación FAW | Guion outbound FAW | Media |
| Garantías FAW (cobertura y condiciones) | Base de Conocimiento | Media |
| Acceso al Sheet del cotizador (para crear Apps Script) | Fase 4: integración en vivo | Alta |
| Mapeo completo Evolution (validar todas las combinaciones Motivo × Voz) | Fase 2: tipificación automática precisa | Media |
| Nombre y correo del Analista de Datos | Fase 1: completar lista de usuarios | Baja |

---

## 13. INSTRUCCIONES PARA CLAUDE CODE

Al abrir Claude Code en el repositorio Servicio-, usar este brief como contexto principal. Adjuntar también el skill `cx-armotor-tone.md` para que todo el código y los textos generados mantengan el tono correcto. Usar `mockup-portal-ceta-v4.html` como referencia visual y de interacción.

### Patrones técnicos obligatorios (v4)
- **State object:** implementar `const S = {...}` como fuente única de verdad. Nunca leer datos del DOM con `.value` en divs; usar `.textContent` para elementos de texto.
- **Tabs de salidas:** las 3 salidas (Quiter, Evolution, Cliente) en tabs compactos, no apiladas.
- **Semáforo:** botón Guardar deshabilitado hasta que campos obligatorios del escenario estén llenos.
- **Naming:** resultado "No contactar" = `noContactar`; toggle síntomas = `novedad`. Sin colisiones.
- **Campos data-f:** todos los inputs/selects del panel usan `data-f="nombreCampo"` para sync automático con `S.f`.

### Secuencia sugerida de prompts para Claude Code:

1. "Lee el brief técnico completo y el mockup v4. Crea la estructura de archivos (index.html, app.js, data.js) con: pantalla de login (selector de usuario + PIN 4 dígitos), sistema de roles (coordinador/analista/asesor_cc/asesor_digital) que filtra vistas y permisos, layout de 3 columnas, Home Operativo como landing con stats filtradas por rol, sidebar con navegación, modo oscuro/claro. Implementa el state object reactivo `S` con `S.user` para el usuario logueado."

2. "Implementa el panel de cierre unificado en la columna derecha siguiendo el mockup v4: 6 secciones con visibilidad condicional, cotizador integrado, tabs para las 3 salidas, semáforo de completitud, y adicionales split (cliente vs taller). Todo conectado al state object."

3. "Carga el contenido de los 10 pasos de Inbound desde flujo-inbound-posventa-10-pasos.md en data.js. Implementa la navegación entre pasos con botones ← →. Cada paso sigue la plantilla Validar/Decir/Hacer/Escalar."

4. "Carga las 25 plantillas WhatsApp desde plantillas-whatsapp-unificadas.md. Implementa la vista con categorías, búsqueda por texto, y botón copiar con formato nativo WhatsApp (asteriscos para negritas)."

5. "Implementa el calificador de leads integrado al guion comercial. Las pills calculan el puntaje P1-P4 en vivo en el panel derecho (sticky)."

6. "Carga toda la Base de Conocimiento en data.js: contactos (70 corporativos, buscables por nombre/ciudad/área), extensiones IVR, sedes, VIP, Telemetría, We Go, garantías, campañas, pico y placa, manuales de mantenimiento. Implementa la búsqueda global del omnibox."

7. "Crea el Apps Script (Code.gs) con los 3 endpoints: guardarGestion (POST), consultarCotizador (GET con CacheService), buscarPlaca (GET). Conecta el botón Guardar del panel al endpoint POST."

8. "Implementa la vista de Control de Gestión para el coordinador: tabla de gestiones con filtros por asesor/fecha/resultado y modo TV (fullscreen, auto-refresh 60s, fuente grande)."

---

*Brief completo para implementación. Consolidar todos los documentos .md del proyecto como referencia durante el desarrollo. Última actualización: Mayo 2026.*
