---
name: design-ceta-spec
description: >
  Redactar el archivo de especificación de un desarrollo del CRM CETA desde
  el punto de vista del USUARIO, cuando el problema ya está claro (idealmente
  después de una sesión de brainstorming y de elegir alternativa). Produce
  docs/specs/YYYY-MM-DD-titulo.md con las secciones: Overview, Usuarios
  Objetivo, Contexto del Problema, Alcance, Comportamiento Esperado, y
  Posibles Errores y Mitigación. Usar cuando Pablo diga "hagamos la spec",
  "documenta el diseño", "especifica esto", "escribe la especificación", o
  al cerrar un brainstorming con alternativa elegida. NO usar si el problema
  aún es ambiguo (primero va el skill brainstorming) ni para documentación
  técnica de código ya escrito.
---

# Design-Ceta-Spec — especificación desde el punto de vista del usuario

Tu trabajo es convertir la claridad lograda (normalmente al cierre de un
brainstorming) en un documento de especificación que cualquier persona del
equipo CETA pueda leer y entender SIN saber programar. El documento describe
qué vivirá el usuario, no cómo se implementa: nada de nombres de funciones,
tablas o archivos en el cuerpo principal (si un detalle técnico es
imprescindible, va en una nota al final de la sección).

## Archivo de salida

- Ruta: `docs/specs/YYYY-MM-DD-titulo.md`
  - `YYYY-MM-DD` = fecha actual.
  - `titulo` = kebab-case, corto y descriptivo (ej: `cola-seguimientos`,
    `recordatorios-cumpleanos`). En español, sin tildes en el nombre del
    archivo.
- Si `docs/specs/` no existe, créala.
- Todo el contenido en español (Colombia), tono claro y directo.

## Proceso

1. Si vienes de un brainstorming en esta misma conversación, usa lo acordado
   (alternativa elegida, respuestas de Pablo) — no vuelvas a preguntar.
2. Si falta algún dato PUNTUAL para completar una sección, haz máximo una
   ronda corta de preguntas (AskUserQuestion). Si el problema entero sigue
   difuso, detente y sugiere correr primero el skill `brainstorming`.
3. Redacta el documento completo con la plantilla de abajo.
4. Muestra un resumen de 5 líneas y pregunta a Pablo si lo aprueba o qué
   ajustar. El commit se hace solo tras su aprobación.

## Plantilla del documento

```markdown
# [Título del desarrollo]

> Spec funcional · CRM CETA Armotor · [fecha] · Estado: Borrador/Aprobada

## 1. Overview
Qué es y para qué sirve, en máximo 4 frases. Una persona nueva en el equipo
debe entender el desarrollo leyendo solo esto.

## 2. Usuarios Objetivo
Qué roles del CETA lo usan (administrador, coordinador, analista, asesor_cc,
asesor_digital) y qué puede hacer cada uno. Si un rol NO debe verlo, decirlo
explícitamente. Incluir volumen esperado de uso (ej: "5 asesores, ~40 veces
al día").

## 3. Contexto del Problema
Qué pasa HOY sin este desarrollo: el dolor concreto, con un ejemplo real del
call center (una llamada, un caso, un seguimiento perdido). Por qué vale la
pena resolverlo ahora.

## 4. Alcance
Dos listas explícitas:
- **Incluye:** lo que este desarrollo SÍ hará en su primera versión.
- **No incluye:** lo que queda fuera a propósito (y a dónde se pospone, si
  se sabe). Esta lista evita el crecimiento silencioso del pedido.

## 5. Comportamiento Esperado
El corazón de la spec. Narrar los flujos como historias paso a paso desde la
pantalla del usuario: "El asesor abre X, ve Y, hace clic en Z y ocurre W".
Cubrir: el flujo principal, los flujos alternos relevantes, qué cambia en
qué vista, y el criterio de éxito (la prueba que Pablo hará para dar el
visto bueno). Usar viñetas numeradas por flujo.

## 6. Posibles Errores y Mitigación
Tabla de 3 columnas: Situación | Qué ve el usuario | Mitigación.
Considerar SIEMPRE al menos: sin conexión / fallo al guardar (regla del
proyecto: el formulario no se limpia y se conserva borrador), datos
duplicados o incompletos, usuario sin permiso, y datos viejos en caché.
```

## Después de aprobar

Ofrecer el siguiente paso natural: implementar según la spec (con las reglas
de siempre: migraciones vía MCP primero si aplica, sin commit hasta revisión,
verificación en navegador). La spec aprobada cambia su estado a "Aprobada"
en el encabezado antes del commit.
