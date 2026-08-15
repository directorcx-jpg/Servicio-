# We Go: notificación propia, recordatorio diario y datos en el CRM

> Spec funcional · CRM CETA Armotor · 2026-08-14 · Estado: Aprobada

## 1. Overview
El servicio We Go gana visibilidad propia en tres frentes: al agendarlo, el
grupo de chat de la sede recibe un mensaje **nuevo con su propio hilo**
(separado del hilo del caso); todos los días a las **4:00 pm** llega al
grupo de cada sede un **recordatorio con los We Go de mañana** (hora,
placa, cliente, teléfono y dirección); y la tabla "We Go agendados" del
Control de Gestión muestra la **dirección y el teléfono** de cada servicio.

## 2. Usuarios Objetivo
- **Talleres por sede** (grupos G Manizales, G Pereira, etc.): reciben el
  aviso al agendar y el recordatorio de las 4:00 pm para planear la ruta.
- **Coordinación y administración**: consultan dirección y teléfono en la
  tabla de Control de Gestión. El Modo TV NO muestra estos datos (datos
  personales proyectados en pantalla).
- Volumen: 1–5 We Go al día entre sedes.

## 3. Contexto del Problema
Hoy el aviso del We Go va como respuesta dentro del hilo del caso (los
hilos se colapsan y el taller no lo ve), nadie recibe un recordatorio en
la víspera —el caso QLZ834 quedó invisible hasta revisarlo a mano— y para
saber la dirección de recogida hay que abrir el caso completo.

## 4. Alcance
- **Incluye:**
  - Mensaje "🚗 We Go agendado" en el grupo de la sede, con hilo propio,
    al agendar o al cambiar la fecha/hora del We Go. Contenido: placa,
    cliente, teléfono, fecha, hora, quién recoge, dirección y trayectos.
  - Funciona para cualquier gestión con We Go (casos internos o gestiones
    del panel), usando el grupo de la sede correspondiente.
  - Recordatorio diario 4:00 pm: un mensaje por sede con TODOS los We Go
    del día siguiente; si una sede no tiene, no recibe nada.
  - Tabla "We Go agendados" de Control con columnas Dirección y Teléfono.
- **No incluye:**
  - Dirección/teléfono en el Modo TV.
  - Recordatorio al cliente final (solo al equipo/taller).
  - Cambios en el mensaje del hilo del caso (sigue igual, con su línea 🚗).

## 5. Comportamiento Esperado
1. Un asesor agenda un We Go para el 20/08 en Manizales → además de la
   actualización en el hilo del caso, el grupo "G Manizales" recibe un
   mensaje nuevo "🚗 We Go agendado" con todos los datos, en hilo propio.
2. El 19/08 a las 4:00 pm, "G Manizales" recibe "🔔 We Go de mañana
   (1)" con la lista: 07:30 · QLZ834 · GERMAN PARDO · tel · dirección.
3. En Control de Gestión, la tabla "We Go agendados" muestra Dirección y
   Teléfono en cada fila.
4. **Criterio de éxito:** agendar un We Go de prueba y ver el mensaje con
   hilo propio en el grupo; al día siguiente de la víspera, confirmar el
   recordatorio de las 4:00 pm; y ver dirección/teléfono en el Control.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| La sede no tiene webhook configurado | No llega mensaje de We Go | El webhook por sede ya existe (G + sede); si falta, se registra en chat_webhooks |
| We Go sin fecha (por confirmar) | No dispara mensaje ni recordatorio | Solo notifica cuando hay fecha; al ponerla, dispara |
| Cambio de fecha del We Go | Llega un mensaje nuevo al hilo propio con la fecha actualizada | El hilo del We Go conserva la secuencia de cambios |
| Falla el envío (Google caído) | Nada visible; el registro queda en la base | El recordatorio del día siguiente cubre el aviso; net._http_response guarda el error |
| Fecha pasada digitada por error | El panel ya no permite guardarla (hallazgo #18) | Validación del semáforo |
