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
