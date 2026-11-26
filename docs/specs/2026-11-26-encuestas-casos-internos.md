# Encuestas como tipo de servicio en casos internos

> Spec funcional · CRM CETA Armotor · 2026-11-26 · Estado: Aprobada en conversación (Pablo, 26/11)

## 1. Overview

El analista puede cargar casos internos de tipo **Encuesta marca** (encuesta
de satisfacción de KIA, Honda o FAW) y **Encuesta Armotor** (encuesta
interna), uno a uno o por carga masiva. El asesor los gestiona desde su
bandeja y los cierra con resultados propios de encuesta:
satisfecho / insatisfecho, además de los generales que aplican.

## 2. Usuarios Objetivo

- **Analista / coordinador / administrador:** cargan los casos de encuesta.
- **Asesor CC:** recibe la encuesta por rotación (Cola B) y la cierra.

## 3. Contexto del Problema

Las encuestas se hacen hoy por fuera del CRM, sin trazabilidad ni rotación,
y no se pueden medir junto al resto de la gestión.

## 4. Alcance

**Incluye:**
- Dos tipos de servicio nuevos, ambos en **Cola B** (no factura):
  Cotización y We Go ocultos al gestionarlos.
- Disponibles en la radicación uno a uno y en la carga masiva del CRM
  (texto exacto: `Encuesta marca`, `Encuesta Armotor`).
- Al gestionar una encuesta solo se muestran estos resultados:
  No contesta · Efectiva – cliente satisfecho · Efectiva – cliente
  insatisfecho · No contactar · Gestión de compañero · Seguimiento.
- "Insatisfecho" exige observación (qué le molestó al cliente).
- En las encuestas el km actual no es obligatorio.
- Los dos resultados nuevos aparecen en Control (filtro y conteos de
  contacto) con su propio color, y en el aviso al chat del grupo.

**No incluye (por ahora):**
- Formulario externo de radicación (taller y comerciales): no lleva
  encuestas.
- Escalamiento automático del cliente insatisfecho (posible siguiente paso).
- Preguntas o calificación numérica de la encuesta dentro del CRM.

## 5. Comportamiento Esperado

1. Joseth carga 20 placas con tipo de servicio "Encuesta marca".
2. Entran a Cola B y se reparten por rotación.
3. Karen abre un caso: el panel muestra solo los 6 resultados de encuesta,
   sin Cotización ni We Go.
4. Cliente insatisfecho → marca "Efectiva – insatisfecho" y escribe el
   motivo en la observación. Si la deja vacía, el CRM no deja guardar.
5. En Control, el filtro de resultado tiene "Encuesta satisfecho" y
   "Encuesta insatisfecho".

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Archivo masivo con el nombre mal escrito | El caso entra con el tipo tal cual, en Cola A | Usar el texto exacto; la plantilla lo indica |
| Lista de motivos personalizada en Configuración sin las encuestas | El motivo se agrega solo al abrir el caso | El panel agrega la opción si falta |
| Insatisfecho sin observación | El semáforo pide "Observación (motivo de insatisfacción)" | Validación obligatoria |
| Asesor elige un resultado de encuesta en una gestión normal | No puede: los botones solo aparecen con motivo de encuesta | Botones condicionados al motivo |

> Nota técnica: valores nuevos `encuesta_satisfecho` y
> `encuesta_insatisfecho` en el enum `resultado_gestion` (migración vía MCP).
