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
| 10 | 2026-08-01 | Pablo | El filtro de fechas consultaba al instante al cambiar cada campo; debe ejecutarse con un botón "Aplicar" | Baja | ✅ Corregido |
| 11 | 2026-08-01 | Pablo | Las notificaciones de Google Chat de un caso nuevo caían en el hilo viejo de la misma placa (hilo por placa) | Alta | ✅ Corregido |
| 12 | 2026-08-01 | Pablo | El usuario de prueba "Servicio al Cliente" participaba en la rotación de casos internos en producción | Alta | ✅ Corregido |
| 13 | 2026-08-01 | Pablo | Radicar un caso de un cliente existente obliga a re-digitar todos sus datos (tiempo perdido y riesgo de duplicar por teléfono mal escrito) | Media | ✅ Corregido |
| 14 | 2026-08-03 | Pablo | "Gestión de compañero" exige observación pero el campo no aparece en pantalla (vivía dentro de la sección de cita, oculta para ese resultado) — no se podía guardar | Alta | ✅ Corregido |
| 15 | 2026-08-04 | Pablo | Directorio telefónico Armotor y lista VIP desactualizados/mal transcritos en la plataforma | Media | ✅ Actualizado |
| 16 | 2026-08-06 | Pablo | Modo TV congelado (refrescaba desde la caché local, no de la base), con pantalla completa forzada (no deja proyectar 3 herramientas) y sin filtros ni paneles configurables | Alta | ✅ Corregido |
| 17 | 2026-08-12 | Pablo | El descuento del cotizador no cuadra con el Excel: el libro cambió su fórmula (descuenta la MO por horas del kit + alineación, sin porción fija) y faltaban los % de 5 en 5 | Alta | ✅ Corregido |

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
- **#10 Botón "Aplicar" en el filtro de fechas** (v1.20.1): cambiar las
  fechas ya no consulta al instante; el rango se ejecuta al pulsar Aplicar.
- **#11 Hilo de Google Chat por caso** (migración
  `chat_thread_por_gestion`, solo base de datos): el hilo de las
  notificaciones era por placa, así que un caso nuevo de una placa
  respondía en el hilo del caso viejo. Ahora cada gestión abre su propio
  hilo y sus actualizaciones sí quedan encadenadas en él.
- **#12 Usuario de prueba fuera de la rotación** (solo datos): "Servicio
  al Cliente" (servicioalcliente@armotor.com) quedó `activo = false` — no
  recibe casos de la rotación ni puede iniciar sesión. Nunca alcanzó a
  tener casos asignados. Si se necesita esa cuenta activa sin rotación,
  la opción es cambiarle el rol a `asesor_digital`.
- **#13 Autocompletado por placa al radicar** (v1.21.0, spec
  2026-08-01-autocompletar-radicacion-por-placa): al salir del campo placa
  en "Radicar caso interno", la plataforma busca la ficha y llena solo los
  campos vacíos (nombre, teléfono, ciudad) con aviso "Datos traídos de la
  ficha"; si la placa no existe o falla la búsqueda, todo sigue manual.
- **#14 Observación visible en Gestión de compañero** (v1.22.0): el campo
  Observación salió de la sección "Adicionales y cierre" (que se oculta en
  ese resultado) a su propio bloque, visible en Agendado y en Gestión de
  compañero. Verificado: sin observación el semáforo pide el campo (ahora
  visible); con ella marca "Listo para guardar".
- **#15 Directorio Armotor y VIP actualizados** (v1.23.0, migración
  `contenido_tipo_directorio`): 74 contactos del Excel "Directorio
  Telefónico Armotor" cargados como tipo `directorio` del contenido
  editable, organizados por sede (Regional, Manizales, Pereira, Armenia,
  Cartago, La Dorada) y visibles en "Contactos y Sedes" → sección
  "Directorio Armotor por sede" (buscable). Lista VIP reemplazada por los
  18 clientes validados de los Sheets (nombres y placas corregidos, placas
  correlacionadas por cliente, teléfonos secundarios y notas de
  verificación); pendientes marcados en la nota de cada entrada (tel de
  Claudia Yepes, placas por confirmar de Jorge Mejía y Susana Trujillo,
  posible duplicado Rafael Mejía = CLIENTE GTQ194). Ambos tipos editables
  desde "Editar contenido".
- **#16 Modo TV dinámico** (v1.24.0, spec 2026-08-06-modo-tv-dinamico):
  el botón Modo TV ahora abre una ventana propia dimensionable (para
  proyectar junto a Evolution y Chatwoot), consulta Supabase cada 30 s con
  el rango y filtros del Control de Gestión, y muestra los paneles
  elegidos con el botón "Paneles TV" (selección recordada): agendas por
  ciudad, gestión por asesor, servicio agendado por asesor, y pendientes/
  no contesta, más los contadores grandes. Si el navegador bloquea la
  ventana emergente o se cierra la pestaña del CRM, avisa qué hacer.
- **#17 Descuento del cotizador alineado al Excel vigente** (v1.25.0):
  se leyeron las fórmulas del libro "5-Cotizador Manual Mayo Posventa
  Ceta" (Drive): el descuento aplica sobre la MO POR HORAS del kit + la
  alineación del modelo (0,6 h), a $219.000/h × IVA — la regla anterior de
  la porción fija de $142.800 (hallazgo #1) quedó obsoleta porque el libro
  cambió. Las horas por kit (419 kits, 41 modelos) se extrajeron del mismo
  libro a `cotizador-horas-seed.js`; si un kit no está en la tabla, cae a
  la MO de precios + alineación. Validado al peso con el caso SONET (QY)
  agrupado al 10%: $673.435 igual que el Excel. Descuentos ahora de 5 en 5
  hasta 50%.
