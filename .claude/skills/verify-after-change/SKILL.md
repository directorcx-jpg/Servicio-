---
name: verify-after-change
description: >
  Verificación obligatoria al terminar la implementación de un plan o spec
  del CRM CETA, ANTES de dar por cerrado el desarrollo. Levanta el servidor
  local, ejecuta 10 casos de prueba importantes directamente en el navegador
  (y contra Supabase donde aplique), compara los resultados con el plan y la
  spec de docs/specs/, y cierra con una de dos salidas: lista de faltantes a
  corregir (y re-verificación) o luz verde explícita. Usar cuando Pablo diga
  "ya terminamos, prueba", "verifica los cambios", "dale una pasada",
  "¿quedó bien?", o cuando el propio asistente considere terminada una
  implementación. NO usar para cambios de solo documentación o comentarios.
---

# Verify After Change — probar de verdad antes de cerrar

Terminar de escribir código NO es terminar. Este skill prueba los cambios
como los viviría un asesor del CETA y solo entonces decide si el desarrollo
se cierra o vuelve a la mesa.

## Realidades del entorno (no las descubras de nuevo)

- Servidor local: `preview_start` con el nombre `ceta` (usa
  `.claude/launch.json` → `python -m http.server 8123`). Nunca servidores
  por Bash.
- En local, los meta tags de Supabase de `index.html` están VACÍOS (las
  credenciales solo se inyectan en el deploy). Si la prueba necesita datos
  reales: (a) pedir a Pablo que ponga las credenciales locales temporalmente
  (sin commitear), o (b) probar contra el sitio publicado
  https://directorcx-jpg.github.io/Servicio-/.
- El login es Google SSO: el asistente NO puede iniciar sesión. Los flujos
  autenticados se prueban con la sesión de Pablo en el panel del navegador,
  o se verifican del lado de los datos con el MCP de Supabase (selects).
- Lo observable sin sesión: carga sin errores de consola, pantalla de login,
  imports/sintaxis de módulos, y todo lo verificable por SQL/REST.

## Proceso

### 1. Preparar
- Leer los DOS documentos de referencia del desarrollo, que deben
  corresponder al mismo cambio:
  - **La spec:** `docs/specs/YYYY-MM-DD-titulo.md` (la del desarrollo que se
    está verificando).
  - **El plan aprobado:** vive como archivo en `~/.claude/plans/` (en este
    equipo: `C:\Users\D. Customer Experien\.claude\plans\`). Tomar el más
    reciente relacionado con este desarrollo (o el de la conversación
    activa) y leerlo completo antes de elegir los casos.
  - Si no se encuentra plan o spec relacionados, reportarlo como hallazgo
    (no bloquea la verificación).
- Levantar el servidor y abrir la app. Primer chequeo siempre: consola sin
  errores (`read_console_messages` con onlyErrors).

### 2. Elegir los 10 casos de prueba
Seleccionar los 10 más importantes PARA EL CAMBIO HECHO, priorizando:
1. El flujo principal nuevo (el "criterio de éxito" de la spec).
2. Los flujos alternos de la spec.
3. La tabla de "Posibles Errores y Mitigación" de la spec (al menos 2).
4. Regresión de lo vecino: lo que comparte código con el cambio
   (guardar gestión, radicar/rotación, reasignar, bandeja, control,
   cotizador, permisos por rol, borrador offline — elegir los que apliquen).
5. El dato en Supabase: que la fila escrita quede como debe (FKs, enums,
   historial) — verificado por SQL vía MCP.

Numerarlos 1–10 con: nombre corto, pasos, resultado esperado.

### 3. Ejecutar
- Probar cada caso en el navegador (read_page, computer, form_input,
  javascript_tool para estados; screenshot como evidencia cuando aporte).
- Lo que requiera sesión y Pablo no esté disponible: verificar el máximo
  posible por datos (MCP) y marcar el caso como "pendiente de sesión" — NO
  marcarlo como aprobado sin evidencia.
- Registrar por caso: PASA / FALLA / PENDIENTE + evidencia de una línea.

### 4. Comparar y decidir
- Contrastar resultados contra AMBOS documentos: la spec (secciones
  Comportamiento Esperado y Alcance: ¿todo lo del "Incluye" quedó
  cubierto?) y el archivo de plan de `~/.claude/plans/` (¿cada paso del
  plan se ejecutó y se refleja en las pruebas?).
- Entregar la tabla de 10 casos con su veredicto y luego UNA de dos salidas:
  - **Faltantes:** lista concreta de lo que falla o no alcanza el objetivo,
    cada ítem con su corrección propuesta. Aplicar las correcciones (reglas
    de siempre) y RE-EJECUTAR los casos fallidos hasta que pasen.
  - **Luz verde:** declaración explícita de que el desarrollo cumple la
    spec, con los casos pendientes-de-sesión listados como tarea de Pablo
    (máximo 2 minutos, pasos exactos).

### 5. Cierre
- Con luz verde: apagar el servidor (`preview_stop`), y si hay código sin
  commitear, proponer el commit (nunca commitear sin revisión de Pablo).
- Si la spec existía, anotar al final del documento la fecha de
  verificación y el resultado ("Verificada YYYY-MM-DD: 10/10" o los
  pendientes).

## Reglas duras

- Nunca dar luz verde con un caso en FALLA.
- Nunca inventar el resultado de un caso no ejecutado: si no se pudo probar,
  es PENDIENTE con su razón.
- Si un caso revela un bug fuera del alcance del cambio, no lo arregles en
  caliente: repórtalo como hallazgo separado para decidir con Pablo.
