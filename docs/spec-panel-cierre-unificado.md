# Panel de Cierre Unificado — Especificación Técnica

> **Ubicación:** Columna derecha del portal (340px)
> **Reemplaza:** Formulario de Seguimiento + Formulario We Go + Formulario Accesorios + Tipificador independiente
> **NO reemplaza:** Formulario Internos CETA (queda como módulo separado)
> **Destino de datos:** Un único Google Sheet vía Apps Script
> **Versión:** 1.0 — Mayo 2026

---

## Principio de diseño

Una sola captura, en la misma pantalla, sin cambiar de pestaña.
El panel derecho evoluciona con la llamada: primero captura datos, luego cotiza, luego cierra.
Las secciones se muestran o se ocultan según las selecciones del asesor.
Los datos ingresados al inicio se propagan a todo el resto (cero doble captura).
Las tres salidas (Quiter, Evolution, Cliente) se generan automáticamente.

---

## Estructura del panel (columna derecha, scroll vertical)

### SECCIÓN 1 · DATOS DEL CLIENTE
**Aparece:** Siempre
**Campos:**

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| Nombre | Texto | Sí | Autocompletable si placa existe en base |
| Teléfono | Texto | Sí | |
| Placa | Texto | Sí | Al digitar, intenta autocompletar datos del cliente |
| Modelo | Texto | Sí | Se autocompleta con placa o se selecciona manual |
| Km actual | Número | Sí para mtto | |
| Ciudad | Select: Pereira, Manizales, Armenia, Cartago, La Dorada | Sí | |
| Fecha nacimiento | Fecha | No (pero siempre preguntar) | Para campañas y segmentación |
| Origen | Select: Base, Formulario, Inbound, Chat MTIC, Otros | Sí | |
| Asesor CETA | Auto (según login) | Sí | |

---

### SECCIÓN 2 · COTIZACIÓN INTEGRADA
**Aparece:** Cuando el resultado NO es "No contesta" / "Fuera de servicio" / similar
**Se oculta:** En gestiones de no-contacto

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| Marca | Select: KIA, Honda, FAW | Sí | |
| Combustión | Select: Gasolina, Diésel, Híbrido, Eléctrico | Sí | Filtra modelos y tabla de mtto |
| Modelo (servicio) | Select dinámico según marca | Sí | |
| Tipo de servicio | Select: Mantenimiento, Revisión, Servicio rápido, Garantía, Inspección, Especializada | Sí | |
| Km del servicio | Select: 5.000 / 10.000 / 20.000 / 30.000... | Sí para mtto | Si es garantía o especializada = campo libre |
| Alineación | Select: Sí / No | No | Afecta precio |
| Descuento | Select: 0% / 5% / 10% / 15% / 30% | No | Solo coordinador puede seleccionar >10% |
| Embellecimiento | Select: No aplica / Básico / Premium | No | |

**Salidas automáticas de la cotización (aparecen al seleccionar modelo + km):**
- Precio calculado (visible en grande)
- Lista de servicios incluidos (expandible)
- Lista de servicios NO incluidos (visible siempre, con color distinto)
- Botón: "Copiar mensaje WhatsApp" → texto formateado con asteriscos
- Botón: "Descargar tarjeta de servicio" → imagen PNG generada con html2canvas

**Tarjeta de servicio (imagen):**
Fondo blanco, esquinas redondeadas, 600x800px aprox.
- Encabezado: logo Armotor + "Cotización de servicio"
- Datos: cliente, modelo, placa
- Precio prominente (fuente grande, color rojo Armotor)
- Tipo de servicio y km
- Bloque verde: "Incluye X servicios" con lista resumida (5-6 principales)
- Bloque naranja: "No incluye (sujeto a inspección)" con 3 items
- Bloque gris: "Lavado básico incluido. Combos de embellecimiento disponibles"
- Pie: "Llevar: tarjeta propiedad, manual garantías, llave pernos"
- Nota legal: "Precios sujetos a variación — [MES] 2026"
- Logo Armotor pequeño + "Le ponemos motor a su vida"

---

### SECCIÓN 3 · NOVEDAD DEL CLIENTE
**Aparece:** Siempre (menos en no-contacto)

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| ¿Reporta novedad? | Toggle Sí/No | Sí | Si Sí → desbloquea campo descripción, bloquea We Go |
| Descripción novedad | Texto libre | Sí si toggle=Sí | Se usa como "Voz del cliente" en Evolution |

**Efecto en el flujo:**
- Si Sí → Sección 4 (We Go) aparece deshabilitada con mensaje: "No aplica — el cliente reporta novedad que requiere diagnóstico presencial"
- Si No → Sección 4 aparece activa

---

### SECCIÓN 4 · WE GO
**Aparece:** Solo si no hay novedad reportada
**Deshabilitada:** Si hay novedad reportada

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| ¿Aplica We Go? | Toggle Sí/No | Sí | |
| Fecha We Go | Fecha | Sí si WG=Sí | |
| Hora We Go | Hora | Sí si WG=Sí | |
| Dirección recogida | Texto | Sí si WG=Sí | |
| Marca vehículo (WG) | Select: KIA, Honda, Otros | Auto (de sección 2) | |
| Línea vehículo (WG) | Texto | Auto (de sección 2) | |
| Nombre cliente (WG) | Texto | Auto (de sección 1) | |
| Teléfono (WG) | Texto | Auto (de sección 1) | |
| Ciudad (WG) | Select: Pereira, Manizales, Armenia | Auto (de sección 1) | Solo ciudades con cobertura |
| Quién recoge | Select: Alfred, Taller Manizales, Taller Armenia | Sí si WG=Sí | Opciones filtradas por ciudad |
| Trayectos | Select: 1, 2 | Sí si WG=Sí | 1=solo ida, 2=ida y vuelta |

**Nota:** Campos auto = se precargan desde secciones anteriores, no los llena de nuevo.

---

### SECCIÓN 5 · ADICIONALES
**Aparece:** Siempre (menos en no-contacto)

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| ¿Se ofreció Telemetría? | Check | No | Solo aplica KIA |
| ¿Se ofrecieron accesorios? | Check | No | |
| Cuáles accesorios | Texto corto | Si check accesorios=Sí | Ej: "tapetes, kit seguridad, rines" |
| Servicios adicionales al principal | Texto libre | No | Ej: "instalación luces, elevavidrios no funcionan" |

---

### SECCIÓN 6 · RESULTADO Y CIERRE
**Aparece:** Siempre

| Campo | Tipo | Obligatorio | Nota |
|-------|------|:-----------:|------|
| Resultado | Select (ver opciones abajo) | Sí | Governa qué secciones son visibles |
| Asesor de servicio (taller) | Texto | Si resultado=Agendado | Nombre del asesor que recibe en taller |
| Fecha cita | Fecha | Si resultado=Agendado | |
| Hora cita | Hora | Si resultado=Agendado | |
| Observación | Texto libre | No | Campo abierto para cualquier nota extra |

**Opciones de Resultado:**

| Resultado | Secciones visibles | Signo auto |
|-----------|-------------------|:----------:|
| Agendado | Todas | Según servicio |
| En seguimiento | 1 + 3 + 6 | — |
| No contesta | 1 + 6 (+ N° marcaciones, envío plantilla) | — |
| Sin kilometraje aún | 1 + 6 (+ km actual, reprograma para) | — |
| Visita otro taller | 1 + 6 (+ razón) | — |
| No volver a contactar | 1 + 6 (+ razón) | — |
| Cliente se comunica | 1 + 3 + 5 + 6 | — |

**Campos condicionales por resultado "No contesta":**

| Campo | Tipo |
|-------|------|
| N° de marcaciones | Select: 1, 2, 3 |
| Tipo no contacto | Select: No contesta, Correo de voz, Buzón, Teléfono apagado, Fuera de servicio |
| ¿Se envió plantilla? | Check |

---

### SALIDAS AUTOMÁTICAS (pie del panel)
Se generan en tiempo real a medida que el asesor llena los campos.

**Salida A — Nota para Quiter / iVuo**
Formato estandarizado con barras:
```
[PLACA] // [TEL] // [KM_ACTUAL] KM // [SERVICIO] [KM_SERVICIO]KM $ [VALOR] [IVA] // [NOVEDAD] // [VALIDACIONES] // CALL CENTER[SIGNO]
```
Signo automático: * (revisión) / ++ (mantenimiento) / ?? (garantía/especializada)
Botón: "Copiar nota"

**Salida B — Tipificación Evolution**
Cuatro campos generados automáticamente:
- Estado: CONTACTO / NO CONTACTO
- Causa: según resultado seleccionado
- Motivo: según tipo de servicio
- Voz del cliente: desde novedad o valor por defecto
Botón: "Copiar tipificación"

**Salida C — Resumen para el cliente (WhatsApp)**
Texto con asteriscos para negritas, tono cercano Armotor.
Botón: "Copiar resumen"

**Salida D — Tarjeta de servicio (imagen)**
Solo disponible si hay cotización.
Botón: "Descargar tarjeta" → genera PNG con html2canvas

---

### BOTÓN FINAL: "GUARDAR GESTIÓN"
Al hacer click:
1. Valida campos obligatorios según el resultado seleccionado.
2. Envía una fila al Google Sheet unificado vía Apps Script (POST asíncrono).
3. Muestra confirmación visual: "Gestión guardada ✓" con animación.
4. Limpia el panel para la siguiente llamada.
5. NO bloquea la interfaz mientras guarda (escritura en background).

---

## ESTRUCTURA DEL GOOGLE SHEET UNIFICADO

**Nombre sugerido:** CETA_Gestiones_2026
**Una pestaña:** Form_Responses (todas las gestiones)

### Columnas:

| # | Columna | Fuente | Ejemplo |
|---|---------|--------|---------|
| A | Marca temporal | Auto | 27/05/2026 10:21:00 |
| B | Asesor CETA | Auto (login) | Karen |
| C | Nombre cliente | Sección 1 | Juan Pablo Soto |
| D | Teléfono | Sección 1 | 3177168928 |
| E | Placa | Sección 1 | NXM830 |
| F | Modelo | Sección 1 | Picanto |
| G | Km actual | Sección 1 | 8.500 |
| H | Ciudad | Sección 1 | Manizales |
| I | Fecha nacimiento | Sección 1 | 15/03/1985 |
| J | Origen | Sección 1 | Inbound |
| K | Tipo servicio | Sección 2 | Mantenimiento |
| L | Km servicio | Sección 2 | 10.000 |
| M | Marca vehículo | Sección 2 | KIA |
| N | Combustión | Sección 2 | Gasolina |
| O | Valor cotizado | Sección 2 | 1.068.978 |
| P | Alineación | Sección 2 | Sí |
| Q | Descuento | Sección 2 | 0% |
| R | Embellecimiento | Sección 2 | No aplica |
| S | Novedad reportada | Sección 3 | No |
| T | Descripción novedad | Sección 3 | |
| U | We Go | Sección 4 | Sí |
| V | Fecha We Go | Sección 4 | 02/06/2026 |
| W | Hora We Go | Sección 4 | 8:00 AM |
| X | Dirección We Go | Sección 4 | Cra 23 #45-12 |
| Y | Quién recoge | Sección 4 | Alfred |
| Z | Trayectos | Sección 4 | 2 |
| AA | Telemetría ofrecida | Sección 5 | Sí |
| AB | Accesorios ofrecidos | Sección 5 | Sí |
| AC | Cuáles accesorios | Sección 5 | Tapetes, kit seguridad |
| AD | Servicios adicionales | Sección 5 | Instalación luces LED |
| AE | Resultado | Sección 6 | Agendado |
| AF | Asesor servicio taller | Sección 6 | Lina Clemencia López |
| AG | Fecha cita | Sección 6 | 02/06/2026 |
| AH | Hora cita | Sección 6 | 8:00 AM |
| AI | Observación | Sección 6 | |
| AJ | Nota Quiter/iVuo | Salida A | MANT 10.000KM $1.068.978... |
| AK | Evo Estado | Salida B | CONTACTO |
| AL | Evo Causa | Salida B | AGENDAMIENTO EXITOSO |
| AM | Evo Motivo | Salida B | CAMBIO DE ACEITE |
| AN | Evo Voz cliente | Salida B | MANTENIMIENTO PREVENTIVO |

**Total:** 40 columnas (cubre los 4 formularios que se eliminan)

---

## VISTA DEL COORDINADOR

**Ubicación:** Módulo "Control de gestión" en el sidebar (solo coordinador)
**Fuente:** Lee el mismo Google Sheet CETA_Gestiones_2026

### Funcionalidades:
- Tabla con todas las gestiones del día (auto-refresh cada 60 seg)
- Filtros: por asesor, fecha, resultado, ciudad, tipo de servicio
- Contadores por asesor: total gestiones, agendados, no contesta, en seguimiento
- Balance de carga: % de distribución entre asesores
- Modo TV: botón que activa vista simplificada en fullscreen, fuente grande, ideal para proyectar

### Modo TV muestra:
- Hora actual
- Gestiones del día (total / agendados / pendientes)
- Tabla simplificada: hora, asesor, placa, resultado (con color)
- Contadores por asesor (barras horizontales)
- Auto-refresh sin intervención

---

## MÓDULO INTERNOS CETA (separado)

Queda como módulo independiente en el sidebar.
Pendiente: Pablo definirá las reglas de asignación aleatoria.
El formulario de radicación y la lógica de duplicados (Co/Ct/Cu) se mantienen.
Los asesores podrán ver sus casos asignados desde el portal.
El coordinador controla desde el Sheet.

---

*Especificación lista para implementación en Claude Code. Última actualización: Mayo 2026.*
