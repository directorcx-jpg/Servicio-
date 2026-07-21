# Roadmap CRM CETA — hacia la vista 360 del cliente

> Norte del proyecto: que un asesor CETA atienda cualquier contacto
> (llamada, chat, visita a taller, lead comercial) desde UNA sola
> plataforma, viendo la historia completa del cliente. Estado de las
> integraciones: **visión a futuro — aún sin accesos ni APIs**; cada fase se
> detalla técnicamente cuando existan credenciales, pasando por el ciclo
> brainstorming → spec → implementación → verificación.

## Fase 0 — Base operativa ✅ (hecho)
- Migración completa de Apps Script/Google Sheets a Supabase (gestiones,
  clientes, vehículos, cotizaciones, casos internos, seguimientos).
- Login con Google Workspace SSO + lista blanca (`usuarios_autorizados`).
- Deploy automático a GitHub Pages con inyección de secretos.
- Rotación de casos internos, asignación desde usuarios reales, asesores de
  taller por sede, `fecha_seguimiento` timestamptz.
- Ciclo de trabajo con skills (brainstorming / design-ceta-spec /
  verify-after-change).

## Fase 1 — Explotar lo que ya existe (corto plazo, sin dependencias externas)
- **Alertas de casos a Google Chat (bot, parte A)** ← EN CURSO: al radicar o
  gestionar un caso interno en el CRM, Supabase notifica automáticamente al
  grupo de chat de la sede (hilo por placa), reemplazando al Form + Sheet +
  bot de Apps Script. Los webhooks viven en secrets de una Edge Function,
  nunca en el frontend. Incluye las columnas `grupo_chat` /
  `nota_solicitante` / `tipo_radicacion` en `gestiones` (cierra deuda).
  Decisión: opción C del brainstorming 2026-07-21 — la parte B (bot
  bidireccional que crea el caso desde el mensaje del chat, eliminando la
  transcripción manual) queda como desarrollo posterior con su propia spec,
  porque requiere app de Google Chat (Cloud/Workspace) y mover la rotación
  de casos del navegador al servidor.
- **Cola de seguimientos**: bandeja de seguimientos del día y vencidos sobre
  `fecha_seguimiento`, con alertas.
- Vista 360 v1 con datos propios: al buscar una placa o teléfono, ver el
  cliente con sus vehículos, gestiones, citas y seguimientos (todo ya está
  en Supabase relacionado por FKs).
- Pulidos pendientes: restaurar borrador tras recarga, etiquetas de
  resultado faltantes.
- Cierre de fase: verificación completa con el skill `verify-after-change`
  antes de declarar la Fase 1 terminada.

## Fase 2 — Vista 360 completa (con datos externos)
Unificar en la ficha del cliente todo su historial multi-canal. Requiere las
integraciones de las fases siguientes; el diseño de la ficha puede empezar
antes con los datos propios (Fase 1).

## Fase 3 — Integración ERP Quiter
Qué aportará: datos maestros del cliente y vehículo (historial de taller,
facturación, órdenes de reparación), reemplazo de la nota manual
"Quiter/iVuo" por registro directo. Prerrequisito: acceso/API de Quiter.

## Fase 4 — Integración Evolution (telefonía)
Qué aportará: click-to-call desde la gestión, registro automático de
llamadas (hoy la tipificación Evolution se copia a mano — `evolution_json`),
y pop-up de la ficha del cliente al recibir llamada. Prerrequisito:
acceso/API de Evolution.

## Fase 5 — Integración Chatwoot (chat)
Qué aportará: conversaciones de WhatsApp/chat dentro del CRM, radicación de
casos internos directamente desde un chat (hoy llegan por grupos y se
transcriben a mano), y plantillas de mensajes conectadas. Prerrequisito:
instancia y API de Chatwoot.

## Fase 6 — Integración BD externa / analítica
Qué aportará: cruces con otras bases del grupo (campañas, retención,
indicadores CX) y reportes para el analista. Se define cuando se concrete
qué base y qué accesos.

## Reglas del roadmap
- Ninguna fase rompe lo ya desplegado: todo cambio pasa por el ciclo de
  skills y por verificación antes de cerrar.
- El orden de las fases 3–6 puede cambiar según qué acceso llegue primero;
  la estructura de datos actual (FKs cliente/vehículo/gestión) es la base
  que las recibe.
- Cada integración nueva empieza con su spec en `docs/specs/`.
