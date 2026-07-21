# Alertas de casos internos a Google Chat

> Spec funcional · CRM CETA Armotor · 2026-07-21 · Estado: Aprobada

## 1. Overview
Cuando el equipo CETA radica o gestiona un caso interno en el CRM, el grupo
de Google Chat de la sede correspondiente recibe automáticamente un mensaje
con el detalle, agrupado en un hilo por placa. Así, el asesor de piso que
pidió el contacto se entera de la creación y de cada avance sin preguntar.
Reemplaza al bot actual que dependía del Formulario de Google y la hoja de
cálculo, que se apagan.

## 2. Usuarios Objetivo
- **Generan alertas (sin hacer nada extra):** administrador, coordinador y
  asesores de call center al radicar o gestionar casos internos en el CRM.
  El asesor digital no participa en casos internos y no genera alertas.
- **Reciben alertas:** los asesores de piso/taller miembros de los 6 grupos
  de chat (Citas Taller, G Manizales, G Pereira, G Armenia, G La Dorada,
  G Cartago). No necesitan cuenta en el CRM.
- **Volumen esperado:** 10–30 casos internos al día, cada uno con 1 mensaje
  de creación y 1–3 de avance.

## 3. Contexto del Problema
Hoy el asesor de piso escribe su solicitud en el grupo de chat, alguien de
la operación la lee y la transcribe a mano en un Formulario de Google, y
solo entonces un bot avisa "se crea caso" en el grupo. Ejemplo real: Yesica
pide agendar la placa NWZ669 por chat; alguien digita el formulario; el bot
responde en el grupo. Con la radicación ya migrada al CRM, ese bot quedó
huérfano: si se apaga el formulario, los grupos dejan de enterarse de todo.
Este desarrollo conecta las alertas directamente al CRM para retirar el
formulario sin perder la comunicación con las sedes.

## 4. Alcance
**Incluye:**
- Mensaje de creación al radicar un caso interno con grupo de origen
  seleccionado: placa, nombre, teléfono, ciudad, tipo de servicio y motivo
  (mismo formato del bot actual).
- Mensaje de avance cada vez que el caso se gestiona: al cerrarse con
  resultado (agendado, no contesta, etc.), al reasignarse y al editarse con
  nota — con estado, ciudad, cliente, placa y observación.
- Los mensajes de un mismo caso se agrupan en un hilo por placa dentro del
  grupo, como hoy.
- El grupo elegido queda registrado en el caso (visible en su detalle) y se
  conserva la nota del solicitante como campo propio.
- Las direcciones de los grupos quedan guardadas de forma segura en el
  servidor — nunca visibles en la página ni en el código público.

**No incluye:**
- Crear el caso automáticamente desde el mensaje del chat (parte B del
  brainstorming: bot bidireccional). Queda como desarrollo posterior con su
  propia spec — requiere permisos de Google Workspace y cambios de fondo en
  la rotación.
- Correo de confirmación al solicitante (se decidió retirarlo: el chat es
  suficiente).
- Alertas de gestiones normales (Inbound/Base): solo casos internos.
- Crear o modificar los espacios de Google Chat.

## 5. Comportamiento Esperado

**Flujo 1 — Radicar un caso (creación):**
1. El asesor CETA abre Casos Internos, llena el formulario de radicación y
   elige el grupo de origen (ej. "G La Dorada").
2. Al pulsar "Radicar y asignar", el caso se crea y se asigna por rotación
   como hoy.
3. Segundos después, en el grupo "G La Dorada" aparece: "📋 Se crea caso
   para iniciar gestión" con placa, nombre, teléfono, ciudad, tipo de
   servicio, motivo y la frase "Tan pronto se tenga contacto con el cliente
   se informarán avances respectivos."
4. El asesor CETA no hace nada adicional: la alerta es automática.

**Flujo 2 — Gestionar el caso (avances):**
1. El asesor CETA gestiona el caso desde su bandeja (lo cierra con un
   resultado, lo edita con una nota, o el coordinador lo reasigna).
2. En el mismo grupo, dentro del hilo de la placa, aparece: "✅ Actualización
   solicitud agenda" con el estado, ciudad, cliente, placa y observación.
3. El solicitante de piso ve toda la historia del caso en un solo hilo.

**Flujo 3 — Caso sin grupo (no aplica alerta):**
1. Si el caso se radica sin grupo de origen o por carga masiva sin grupo,
   se crea normalmente y simplemente no se envía alerta.

**Criterio de éxito (prueba de Pablo):** radicar un caso de prueba desde el
CRM eligiendo "G La Dorada" y ver el mensaje llegar al espacio real de
Google Chat en segundos, en el formato de siempre.

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión al radicar | "⚠️ No se pudo radicar el caso — reintenta"; el formulario NO se limpia | Regla del proyecto: el caso no se crea a medias; se conservan los datos digitados |
| El caso se crea pero el chat no responde | Nada distinto en el CRM; el caso queda creado y asignado normal | La gestión NUNCA depende del chat: la alerta fallida queda registrada para reintento/diagnóstico, el caso sigue su flujo |
| Grupo mal escrito o retirado | El caso se crea; la alerta no llega | Los grupos se eligen de una lista cerrada (no texto libre); si un grupo cambia de dirección, se actualiza en el servidor sin tocar la app |
| Placa duplicada con caso abierto | Aviso de duplicado con opción de agregar nota o crear de todos modos (como hoy) | Si crea de todos modos, la alerta llega al mismo hilo de la placa, manteniendo la historia unida |
| Usuario sin permiso de radicar | No ve el formulario de radicación | Permisos por rol ya vigentes; sin cambios |
| Datos viejos en caché | La bandeja puede tardar unos segundos en reflejar el caso nuevo | La bandeja se revalida sola al entrar a la vista; las alertas salen del dato ya guardado, nunca de la caché |
