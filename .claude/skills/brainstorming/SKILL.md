---
name: brainstorming
description: >
  Sesión de brainstorming obligatoria antes de empezar CUALQUIER desarrollo
  nuevo en el CRM CETA (nueva funcionalidad, módulo, cambio de flujo, cambio
  de esquema en Supabase, o corrección que toque más de un archivo). Hace
  preguntas para eliminar ambigüedades ANTES de tocar código y termina
  presentando 2–3 alternativas de implementación con una recomendación.
  Usar cuando Pablo diga "quiero agregar", "necesito que el CRM haga",
  "vamos a construir", "nueva funcionalidad", "tengo una idea", o describa
  un desarrollo nuevo sin especificaciones completas. NO usar para bugs
  puntuales de un solo archivo ni para preguntas informativas.
---

# Brainstorming CETA — antes de escribir código

Eres el copiloto técnico del CRM CETA de Armotor. Antes de implementar
cualquier desarrollo nuevo, tu trabajo es ELIMINAR AMBIGÜEDADES preguntando,
y solo después proponer alternativas. Nunca saltes directo a editar código.

## Contexto fijo del proyecto (no lo vuelvas a preguntar)

- **Stack:** SPA vanilla JS sin bundler (index.html + app.js + data.js, ES
  Modules por CDN), hosting GitHub Pages con deploy automático por GitHub
  Actions (inyecta credenciales Supabase en meta tags).
- **Backend:** Supabase (proyecto Armotor-Ceta). Tablas núcleo: `gestiones`,
  `clientes`, `vehiculos`, `cotizaciones`, `usuarios`, `usuarios_autorizados`,
  `asesores_taller`, `sedes`. RLS activo; enums: `rol_usuario`,
  `ciudad_sede`, `origen_gestion`, `resultado_gestion`, `estado_gestion`.
- **Auth:** Google Workspace SSO (@armotor.com) vía Supabase Auth; lista
  blanca en `usuarios_autorizados`; el uuid nace con el primer login.
- **Apps Script:** vive SOLO para el cotizador KIA (`consultarCotizador`) y
  `ping`. Todo lo demás es Supabase.
- **Decisiones vigentes:** `usuarios_autorizados` es la única fuente de
  personas; online-first (localStorage solo caché de lectura + borrador);
  rotación automática solo `asesor_cc`; asignación manual = cc + coordinador
  + analista + administrador; todo en español (Colombia).
- **Roles:** administrador (Pablo), coordinador, analista, asesor_cc (5),
  asesor_digital (2). Permisos en `DATA.permisos`.

## Fase 1 — Preguntar (una ronda, máximo 2)

Usa la herramienta de preguntas al usuario (AskUserQuestion) con opciones
concretas — no preguntas abiertas sueltas. Cubre SOLO los vacíos reales del
pedido, eligiendo entre estos frentes según apliquen:

1. **Quién lo usa:** ¿qué roles ven/usan esto? ¿cambia `DATA.permisos`?
2. **Datos:** ¿necesita tablas/columnas/enums nuevos en Supabase, o basta
   con lo que existe? ¿quién puede leer/escribir (RLS)?
3. **Ubicación en la UI:** ¿vista nueva en el sidebar, sección dentro de una
   vista existente, o modal?
4. **Volumen y frecuencia:** ¿cuántos registros/usos al día? (decide caché,
   throttle, paginación).
5. **Estados y ciclo de vida:** ¿el dato nace, cambia y muere cómo? ¿quién
   lo cierra/edita después de creado?
6. **Criterio de éxito:** ¿cómo sabrá Pablo que quedó bien? (la prueba
   funcional concreta que hará).

Reglas de la fase:
- Máximo 4 preguntas por ronda; si con una ronda basta, no hagas segunda.
- Si el pedido ya trae la respuesta, no la preguntes.
- Si detectas conflicto con una decisión vigente (p. ej. volver a listas en
  localStorage), señálalo explícitamente y pregunta cómo resolverlo.

## Fase 2 — Presentar alternativas (el entregable)

Presenta **2 o 3 alternativas** de implementación. Para cada una:

- **Nombre corto** y descripción en 2–3 frases.
- **Qué toca:** archivos del repo + cambios en Supabase (tablas/policies),
  cada uno en una línea.
- **Esfuerzo relativo** (S/M/L) y el principal riesgo o limitación.

Cierra con una **recomendación única** y su porqué en una frase, y termina
preguntando con cuál alternativa arrancar. NO empieces a implementar hasta
que Pablo elija.

## Después de elegir

Resume la alternativa elegida en un mini-plan (pasos ordenados, con el SQL
de Supabase primero si aplica) y procede con las reglas de siempre: sin
commit hasta revisión, verificación en navegador, y migraciones vía MCP.
