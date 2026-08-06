# Modo TV dinámico (ventana espejo con paneles configurables)

> Spec funcional · CRM CETA Armotor · 2026-08-06 · Estado: Aprobada

## 1. Overview
El Modo TV deja de ser una pantalla congelada y de pantalla completa
forzada: ahora abre una **ventana propia** que se puede dimensionar al
tercio del televisor (junto a Evolution y Chatwoot), se actualiza **en
línea cada 30 segundos** consultando la base de datos, hereda los filtros
del Control de Gestión y muestra los paneles que el coordinador elija.

## 2. Usuarios Objetivo
- **Administrador y coordinador** (los roles con permiso de Modo TV):
  configuran los paneles y proyectan la ventana en el televisor del call
  center. Uso: encendido toda la jornada.
- **Asesores**: lo ven en el televisor; no lo operan.

## 3. Contexto del Problema
El Modo TV actual refresca cada minuto pero desde la memoria del navegador
(no consulta la base), así que la gestión del equipo no se refleja y el
tablero pierde credibilidad. Además fuerza pantalla completa: no se puede
proyectar junto a Evolution y Chatwoot, que es como opera el televisor del
call center. Sus tarjetas son fijas y no responden a ningún filtro.

## 4. Alcance
- **Incluye:**
  - Botón "Modo TV" abre una ventana independiente, dimensionable; el
    diseño se adapta al tamaño (tercio de pantalla, media o completa).
  - Actualización automática cada 30 segundos consultando Supabase con el
    rango de fechas del Control de Gestión, más los filtros de asesor y
    resultado aplicados al abrirlo.
  - Paneles disponibles (se eligen con el botón "Paneles TV" y la
    selección queda recordada en el navegador): **Agendas por ciudad**,
    **Gestión por asesor** (con desglose por resultado), **Tipo de
    servicio agendado por asesor**, **Pendientes y No contesta**.
  - Encabezado siempre visible: reloj, rango consultado y contadores
    grandes (Total · Agendados · Seguimiento · No contesta).
  - Si la pestaña del CRM que alimenta el TV se cierra, la ventana muestra
    "Fuente cerrada — reabre el Modo TV desde Control de Gestión".
- **No incluye:**
  - Modo TV autónomo que viva sin la pestaña del CRM (alternativa B,
    descartada por ahora).
  - Rotación automática de paneles (posible mejora futura).
  - Gráficas de líneas/históricas: los paneles son del rango consultado.

## 5. Comportamiento Esperado
1. **Flujo principal:** Pablo abre Control de Gestión (rango de la
   semana), pulsa "Paneles TV" y marca los 4 paneles → pulsa "Modo TV" →
   se abre la ventana; la arrastra al televisor y la dimensiona al tercio
   derecho junto a Evolution y Chatwoot. Cada 30 s las cifras cambian
   solas conforme el equipo gestiona.
2. **Flujo — filtrar lo proyectado:** aplica el filtro de un asesor o un
   rango distinto en Control y vuelve a pulsar "Modo TV": la ventana se
   actualiza a ese contexto (el título del TV muestra el rango y filtros).
3. **Flujo — fuente cerrada:** si se cierra la pestaña del CRM, el TV
   muestra el aviso de fuente cerrada en grande.
4. **Criterio de éxito (prueba de Pablo):** con el TV proyectado, un
   asesor guarda una gestión agendada; en máximo 30 segundos el contador
   de Agendados y el panel de su ciudad/asesor suben solos, sin tocar
   nada. La ventana convive con Evolution y Chatwoot en un solo televisor.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| El navegador bloquea la ventana emergente | Aviso "Permite las ventanas emergentes para este sitio" | Mensaje con instrucción; al permitir, se reabre con el mismo botón |
| Sin conexión durante un refresco | El TV conserva las últimas cifras y muestra "última actualización hace X min" en el pie | Reintenta en el siguiente ciclo de 30 s |
| Se cierra la pestaña del CRM | Aviso grande "Fuente cerrada" | Reabrir desde Control de Gestión |
| Ningún panel seleccionado | El TV muestra el encabezado con contadores y un aviso "elige paneles en Control" | El selector marca los 4 por defecto la primera vez |
| Usuario sin permiso de Modo TV | No ve el botón (igual que hoy) | Permiso `modoTV` sin cambios |

---
Verificada 2026-08-06 (v1.24.0, parcial): PASA en local — módulos cargan
sin errores de consola; popup bloqueado muestra el aviso correcto; el HTML
del TV (probado con datos de muestra) genera los 4 paneles, los KPIs, el
rango de filtros, el pie "En línea" y el diseño responsive (auto-fit +
clamp). El navegador embebido de prueba bloquea todo popup, así que la
apertura real de la ventana, el refresco de 30 s y la convivencia con
Evolution/Chatwoot en el televisor quedan como prueba de Pablo (criterio
de éxito de la sección 5).
