# Piloto en producción — CRM CETA

> Inicio: 2026-07-24 · Este documento ES la bitácora del piloto: cada
> hallazgo de los asesores se registra aquí, se prioriza y se marca cuando
> queda corregido y desplegado. Los ajustes puntuales de un archivo van
> directo; lo que implique cambio de flujo o esquema pasa por el ciclo de
> skills.

## Estado del arranque
- [x] Datos de prueba eliminados de la base (gestiones, clientes, vehículos,
  cotizaciones) — los usuarios, asesores de taller, sedes y webhooks se
  conservan.
- [x] Versión desplegada al iniciar: 1.18.0.
- [ ] Todos los asesores hicieron Ctrl+F5 y entraron con su cuenta.

## Cómo reportar (para el equipo)
Cada hallazgo con: **quién** lo encontró, **qué pasó** (pasos), **qué
esperaba**, y pantallazo si aplica. Pablo los trae a esta bitácora.

## Hallazgos

| # | Fecha | Reportó | Hallazgo | Prioridad | Estado |
|---|-------|---------|----------|-----------|--------|
| 1 | 2026-07-24 | Pablo | Descuento del cotizador no cuadra con la base oculta del Excel: la columna MO del libro trae $142.800 fijos ($120.000+IVA) que no se descuentan | Alta | ✅ Corregido |
| 2 | 2026-07-24 | Pablo | Buscador global no sugiere clientes al buscar por PLACA (por teléfono sí) | Alta | ✅ Corregido |
| 3 | 2026-07-24 | Pablo | Falta resultado "Gestión de compañero" (contacto ya realizado por otro asesor) | Media | ✅ Corregido |
| 4 | 2026-07-24 | Pablo | We Go se agendan a ciegas: falta vista por día/ciudad/franja y aviso de doble agendamiento | Alta | ✅ Corregido |
| 5 | 2026-07-24 | Pablo | Franjas horarias no corresponden a la operación (deben ser 7:10 → 17:50 cada 20 min) | Media | ✅ Corregido |
| 6 | 2026-07-24 | Pablo | Falta opción "Otros" en grupo de chat origen al radicar | Baja | ✅ Corregido |
| 7 | 2026-07-29 | Pablo | Nota Quiter/Evolution desordenada para el asesor de taller: debe iniciar con motivo + tipo de mantenimiento + costo, y sin signos (++, ??, *) | Alta | ✅ Corregido |
| 8 | 2026-07-29 | Pablo | El histórico de seguimientos (Google Sheet) no está en la plataforma: al buscar por placa/teléfono no se ve si otro asesor ya gestionó el caso (regla de 20 días) | Alta | ✅ Importado |
| 9 | 2026-07-31 | Pablo | Control de Gestión sin filtro por fecha de radicación: no se puede auditar lo radicado por rango con cifras completas | Media | ✅ Corregido |

## Corregidos y desplegados
- **#1 Descuento del cotizador** (v1.18.1): la fórmula ahora descuenta solo
  la base descontable (MO − $142.800 fijos). Validado al peso contra dos
  casos de la base oculta: SOLUTO 30% → $856.182 y PICANTO 20% → $862.221.
  La porción fija quedó configurable en `data.js` (`moFijaNoDescontable`).
- **#2 Búsqueda por placa en el buscador global** (v1.18.2): la guarda
  anti-carrera comparaba el input (mayúsculas) contra el término en
  minúsculas y descartaba toda sugerencia con letras; los teléfonos (solo
  dígitos) sí pasaban. Comparación ahora en minúsculas por ambos lados.
  Verificado con la placa GXT151 (existente en la base).
- **#3–#6 Paquete de mejoras** (v1.19.0, spec
  2026-07-24-mejoras-piloto-gestion-companero-wego-franjas): resultado
  "Gestión de compañero" como categoría propia del enum (mínimo: nombre +
  placa + observación obligatoria, exento de km; Evolution: CONTACTO ·
  GESTIONADO POR COMPAÑERO); sección "We Go agendados" en Control Gestión
  + advertencia en vivo no bloqueante al agendar franja ocupada; franjas
  7:10 → 17:50 cada 20 min en todos los campos de hora; grupo "Otros" al
  radicar (sin alerta de chat, por diseño).
- **#7 Nota Quiter/Evolution reordenada** (v1.19.1): la nota ahora abre con
  `MOTIVO + KM + VALOR IVA INCLUIDO`, sigue la novedad del cliente, luego
  las validaciones (`VALIDAR ADICIONALES // VALIDAR ACCESORIOS // ...`),
  placa y teléfono al final, y cierra con `// CALL CENTER /INICIALES`.
  Se retiraron los signos ++, ?? y * (solo queda //). Aplica a todos los
  resultados, incluida la nueva "Gestión de compañero".
- **#8 Importación del histórico de seguimientos** (2026-07-31, solo datos,
  sin cambio de código). El primer intento (2026-07-30) cargó 111 filas de
  abril porque el export de Drive truncaba la hoja; se revirtió completo y
  se rehizo desde el Excel descargado íntegro (la hoja real tiene 3.823
  filas). Quedaron los **1.263 registros del 01/07 al 30/07 de 2026**
  (1.152 agendados + 111 en seguimiento), con 1.135 clientes (nombre
  provisional `CLIENTE <placa>`) y 1.140 vehículos. Cada gestión conserva
  su fecha real (`creado_en`) y su dueño mapeado por EJECUTIVO → usuario
  (Mille Johana 280, Héctor Alejandro 304, Karen Julieth 254, Juan Manuel
  236, Juan Diego 189). **Solo consulta:** todos van con
  `fecha_seguimiento = null`, así que ninguno entra a la cola de
  seguimientos ni genera pendientes; la fecha de próxima llamada del
  Excel quedó como texto en la observación. Etiquetados
  `tipo_radicacion = 'Importado'` para identificarlos o revertirlos.
  Migración asociada: `gestiones_sede_nullable_historico` (filas
  históricas sin ciudad).
- **#9 Filtro por fecha de radicación en Control de Gestión** (v1.20.0,
  spec 2026-07-31-filtro-fecha-radicacion-control-gestion): selector
  desde/hasta que consulta el rango directo a Supabase (no a la caché con
  tope); contadores, balance por asesor, tabla y gráficas reflejan todo lo
  radicado en el rango; columna "Radicado" (fecha y hora) visible; por
  defecto últimos 7 días; tope de seguridad 2.000 con aviso; rango
  invertido se corrige solo.
