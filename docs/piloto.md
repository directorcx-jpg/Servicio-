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

## Corregidos y desplegados
- **#1 Descuento del cotizador** (v1.18.1): la fórmula ahora descuenta solo
  la base descontable (MO − $142.800 fijos). Validado al peso contra dos
  casos de la base oculta: SOLUTO 30% → $856.182 y PICANTO 20% → $862.221.
  La porción fija quedó configurable en `data.js` (`moFijaNoDescontable`).
