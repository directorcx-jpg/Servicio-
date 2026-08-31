# Ingesta automática de no-ingresos al taller

> Spec funcional · CRM CETA Armotor · 2026-08-31 · Estado: Aprobada

## 1. Overview

Cuando un vehículo agendado no llega al taller, el sistema de control de IT
envía un correo de alerta (30 minutos después de la hora agendada). Este
desarrollo convierte cada una de esas alertas, automáticamente, en un caso
interno del CRM marcado "No ingresó", asignado al asesor CETA que agendó la
cita (o a la rotación si la cita no nació en el CRM), para que el call
center contacte al cliente y reagende. Reemplaza el proceso actual en el que
el correo le llega al asesor de servicio del taller y la llamada de
reagendamiento no está ocurriendo.

## 2. Usuarios Objetivo

- **Asesores CC (5):** reciben los casos "No ingresó" en su bandeja de
  Casos Internos, como cualquier caso, y los gestionan desde el panel.
- **Coordinador / analista / administrador:** ven los casos en Control de
  Gestión filtrando por la marca, reasignan si hace falta.
- **Asesor digital:** no participa (igual que en el resto de casos internos).
- Volumen esperado: 3 a 8 alertas por día hábil, en horario de taller
  (7 am – 6 pm), todas las sedes.

## 3. Contexto del Problema

Hoy la alerta llega por correo al asesor de servicio de la sede para que
llame a reagendar, pero esa llamada no está ocurriendo: el correo se pierde
entre los demás y nadie tiene la tarea en una cola con seguimiento. Ejemplo
real del 29/08: el vehículo LPW695 estaba agendado a las 8:40 en Manizales,
la alerta salió a las 9:14, y ningún asesor contactó al cliente — la cita se
perdió sin reagendar. Con el piloto ya son ~7 alertas en 2 días que no se
convierten en gestión.

## 4. Alcance

**Incluye:**
- Lectura automática del buzón del director CX cada 20 minutos, lunes a
  sábado de 7:30 am a 2:00 pm, buscando las alertas de
  no-ingreso del sistema de control.
- Creación automática del caso interno con marca **"No ingresó"**, origen
  propio (visible en Control de Gestión con su badge), y toda la
  información del correo en la nota: placa, ciudad/sede, asesor de taller
  y hora agendada.
- Asignación: si la placa tiene una gestión **agendada en el CRM en los
  últimos 45 días**, el caso vuelve al asesor CETA que la agendó; si no
  hay match, entra a la rotación normal de Cola A.
- Vinculación por placa: si el vehículo ya existe en el CRM, el caso queda
  ligado al cliente y sus teléfonos; si no, queda con la placa y los datos
  se completan al contactar.
- Sin duplicados: una placa genera máximo un caso por día, aunque el
  correo llegue repetido o la lectura corra varias veces.
- Sin notificaciones de chat: los casos usan el grupo "No ingresos", que
  no tiene webhook (igual que "Leads posventa").

**No incluye (por ahora):**
- Leer el Google Sheet de entradas directamente (IT no lo comparte; si
  algún día lo comparten, se migra el puente sin cambiar el CRM).
- Verificar si el vehículo finalmente sí ingresó más tarde (el asesor lo
  confirma en la llamada).
- Alertas de otras fuentes (We Go, citas del propio CRM sin correo de IT).
- Cambiar el correo de IT ni sus destinatarios.

## 5. Comportamiento Esperado

**Flujo principal — de la alerta al caso:**
1. IT detecta que la placa NWZ780 (Manizales, agendada 8:24) no ingresó y
   envía el correo de alerta.
2. En la siguiente pasada (máximo 20 minutos), el sistema lee el correo,
   extrae placa, ciudad, asesor de taller y hora agendada.
3. Busca la placa en el CRM:
   - Si hay una gestión con cita agendada en los últimos 45 días → el caso
     se asigna al asesor CETA que la agendó, con motivo "No ingresó a cita
     (era su agenda)".
   - Si no → entra a la rotación de Cola A, motivo "Rotación Cola A (no
     ingresó)".
4. El caso aparece en la bandeja de Casos Internos del asesor asignado,
   pendiente, con la nota: "🚗 NO INGRESÓ AL TALLER — Placa NWZ780 ·
   Manizales · Agendada 8:24 · Asesor taller: Lina Clemencia López.
   Contactar al cliente para confirmar estado y reagendar."
5. El asesor lo gestiona como cualquier caso: llama, reagenda (cita nueva)
   o tipifica el resultado.

**Flujo alterno — cliente desconocido:**
1. La placa no existe en el CRM → el caso se crea solo con la placa y la
   nota; el asesor consigue el teléfono con el asesor de taller de la sede
   (dato en la nota) y completa los datos al radicar el contacto.

**Flujo alterno — correo repetido o pasada doble:**
1. La misma placa el mismo día no genera un segundo caso; la lectura lo
   ignora y lo deja registrado en su bitácora.

**Visibilidad en Control de Gestión:**
1. El filtro Origen incluye "No ingresó taller"; al elegirlo se ven los
   casos del rango con su estado, para medir cuántos no-ingresos se
   recuperaron (reagendados ÷ recibidos), igual que la efectividad de
   leads.

**Criterio de éxito (prueba de Pablo):**
1. Llega una alerta real al correo → antes de 25 minutos el caso está en
   la bandeja del asesor correcto, sin duplicado, sin mensaje en los chats
   de Google, y visible en Control con su marca. Las alertas de los días
   anteriores (backfill desde el 29/08) también quedan cargadas al activar.

> Nota técnica: puente = rutina programada de Claude (conector Gmail del
> director CX) que llama a la Edge Function `ingestar-no-ingresos` con
> secreto; dedupe en tabla `no_ingresos_ingestados` (placa+fecha); origen
> nuevo `no_ingreso` en el enum; horario cron lun–sáb 7:30–14:00 COL cada 20 min.

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| El formato del correo de IT cambia | No entran casos nuevos | La bitácora registra "correo no reconocido" con el asunto; el administrador lo detecta en la tarjeta de estado y se ajusta el lector |
| La rutina no corre (falla de Claude o del conector) | Casos llegan tarde | Cada pasada procesa TODO lo no ingresado (no solo lo último): la siguiente corrida se pone al día sola |
| Correo repetido / pasada doble | Nada (ningún duplicado) | Dedupe por placa + fecha del día en el servidor |
| Placa sin cliente en el CRM | Caso solo con placa y nota | El asesor completa datos al contactar (regla v1.28.1: guardar parcial no borra nada) |
| El asesor que agendó ya no está activo | El caso no se queda huérfano | Si el asesor del match está inactivo, cae a rotación Cola A |
| Vehículo sí ingresó tarde | Caso innecesario en bandeja | El asesor confirma en la llamada y tipifica "Se comunica" con la observación; sigue documentado |
| Usuario sin permiso intenta ver Control | Mensaje de "sin acceso" (actual) | Sin cambios: permisos existentes |
