# Formulario de radicación de casos internos (autoservicio)

> Spec funcional · CRM CETA Armotor · 2026-10-24 · Estado: Aprobada

## 1. Overview

Página propia, pensada para el celular, con la que los asesores de taller y
los asesores comerciales radican directamente un caso para el call center,
en lugar de escribirlo en el chat de Google. El formulario exige todos los
datos del cliente y de la solicitud antes de enviar, crea el caso en el CRM
con la rotación normal de asesores y lo publica en el hilo del grupo de chat
que corresponde, para que quede la trazabilidad completa desde el primer
minuto.

## 2. Usuarios Objetivo

- **Asesores de servicio de taller** (todas las sedes): abren el enlace,
  eligen su sede y su nombre de la lista y radican. No tienen usuario en el
  CRM y no lo necesitan.
- **Asesores comerciales** (todas las sedes): mismo formulario; sus casos
  salen al grupo de chat "Citas Taller", estén en la ciudad que estén.
- **Asesores CC (rotación)**: reciben el caso en su bandeja de Casos
  Internos, igual que hoy; ya no tienen que transcribir nada del chat.
- **Coordinador / administrador**: mantienen la lista de asesores
  comerciales desde Configuración y pueden cambiar la clave del enlace si se
  filtra fuera de la compañía.
- **Analista / asesor digital**: sin cambios.
- Volumen esperado: 10 a 20 solicitudes por día hábil, en horario de taller.

## 3. Contexto del Problema

Hoy el asesor de taller o el comercial escribe la solicitud en el chat de
Google y alguien del CETA la transcribe al CRM con "Radicar nuevo caso".
Los mensajes llegan incompletos (sin teléfono, sin placa, sin decir qué
necesita el cliente), hay que devolverse a preguntar y el caso se demora o
se pierde. Además, el dato de "grupo de chat" quedó desordenado: desde
septiembre hay 382 casos marcados "Otros", más 108 como "OTROS"/"otros",
grupos repetidos en mayúsculas y hasta 14 casos con texto de repuestos en
ese campo por un archivo con columnas corridas. Un caso típico: un
comercial de Manizales escribe en "Citas Taller" por un cliente que va al
taller de Pereira, y el caso queda registrado como si fuera de Manizales.

## 4. Alcance

**Incluye:**
- Página de radicación aparte del CRM, abierta con un enlace (o QR) que
  lleva una clave de acceso; sin login.
- Primer paso: "¿Desde dónde solicitas?" → Taller o Comercial.
  - Taller: elige su sede y su nombre de la lista de asesores de taller de
    esa sede. El caso sale al grupo de chat de su sede.
  - Comercial: elige su nombre de la lista de asesores comerciales. El caso
    sale siempre al grupo "Citas Taller".
- Campo obligatorio aparte: **"Taller donde se atenderá el cliente"**. Es
  la sede del caso. Para un asesor de taller viene precargada con su sede y
  la puede cambiar; para un comercial no viene precargada.
- Datos obligatorios del cliente: placa, nombre y celular (celular
  colombiano válido, placa con formato válido).
- Datos obligatorios de la solicitud: tipo de servicio (define la cola de
  rotación, igual que hoy) y detalle de lo que necesita el cliente (mínimo
  15 caracteres).
- Al enviar: el caso se crea en el CRM, se asigna por la rotación normal y
  se publica en el hilo del grupo de chat con: quién solicita (y si es de
  taller o comercial), taller donde se atiende, datos del cliente, servicio
  y detalle.
- Confirmación en pantalla: "Caso radicado — asignado a Karen".
- Si la placa ya tiene un caso abierto dentro de la ventana de propiedad
  (10 días), no se crea un caso nuevo: la solicitud se agrega al historial
  del caso existente y se le avisa a quien radica quién lo tiene.
- Lista de asesores comerciales (nombre, sede, activo) administrable por
  coordinador y administrador en Configuración.
- Clave del enlace cambiable por el administrador.

**No incluye (por ahora):**
- Consulta del estado del caso desde el formulario (el seguimiento se ve en
  el hilo del chat).
- Adjuntar fotos o documentos.
- Corregir el histórico desordenado de "grupo de chat" (se puede hacer
  después como limpieza aparte).
- Radicar casos de leads o no-ingresos (siguen entrando automáticos).

## 5. Comportamiento Esperado

**Flujo principal — asesor de taller:**
1. Lina, asesora de servicio de Manizales, abre el enlace del formulario
   desde su celular.
2. Elige "Taller", luego "Manizales" y su nombre en la lista. El campo
   "Taller donde se atenderá el cliente" queda en Manizales.
3. Digita placa, nombre y celular del cliente; si la placa ya existe en el
   CRM, el nombre y el celular se completan solos y ella solo confirma.
4. Elige "Mantenimiento" y escribe el detalle ("cliente pide cotización de
   la revisión de 40.000 y revisar ruido en la suspensión").
5. Toca "Radicar". El botón se bloquea mientras se envía.
6. Ve "Caso radicado — asignado a Juan Manuel" y el formulario queda limpio
   para el siguiente, conservando su sede y su nombre.
7. En el grupo "G Manizales" aparece el hilo del caso con todos los datos.
   Cuando Juan Manuel agende, la actualización sale en ese mismo hilo
   (como funciona hoy).

**Flujo alterno — asesor comercial en otra ciudad:**
1. Carlos, comercial de Manizales, elige "Comercial" y su nombre.
2. Elige como taller de atención "Pereira" (el cliente vive allá).
3. El caso queda con sede Pereira y el hilo sale en "Citas Taller" con la
   línea "Solicita: Carlos (Comercial) — Se atiende en: Pereira".

**Flujo alterno — la placa ya tiene caso abierto:**
1. Lina radica la placa LPW123, que Karen tiene en gestión desde hace 3
   días.
2. No se crea un caso nuevo. Lina ve "Esta placa ya tiene un caso abierto
   con Karen; agregamos tu solicitud a ese caso".
3. Karen ve la nueva solicitud en el historial del caso y el hilo del chat
   recibe la nota.

**Mantenimiento de la lista de comerciales:**
1. El coordinador abre Configuración → "Asesores comerciales".
2. Agrega nombre y sede, o marca a alguien como inactivo (deja de aparecer
   en el formulario).

**Criterio de éxito (prueba de Pablo):**
1. Radicar desde el celular como asesor de taller y como comercial: los dos
   casos aparecen en la bandeja del asesor asignado con todos los campos,
   los hilos salen en el grupo correcto (sede vs Citas Taller) y la sede
   del caso del comercial es la del taller elegido.
2. Intentar enviar sin celular o con placa inválida: el formulario no deja
   enviar y señala el campo.
3. Radicar dos veces la misma placa: el segundo envío se suma al primer
   caso, no crea otro.

> Nota técnica: página `radicar.html` en el mismo sitio; Edge Function
> `radicar-caso` (clave del enlace + límite de envíos por minuto) que valida
> de nuevo en el servidor, crea/actualiza cliente y vehículo, aplica la
> regla de propiedad por placa, asigna con la rotación existente y guarda
> la gestión con el grupo de chat calculado; el trigger actual de
> notificación publica el hilo. Tabla nueva de asesores comerciales.

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión o falla al enviar | "No se pudo radicar, intenta de nuevo"; el formulario NO se borra | Los datos se conservan en el celular hasta un envío exitoso (regla del proyecto) |
| Doble toque en "Radicar" | Un solo caso | Botón bloqueado durante el envío + regla de placa duplicada en el servidor |
| Datos incompletos o mal escritos | El campo se marca en rojo y no deja enviar | Validación en pantalla y otra vez en el servidor (celular colombiano, placa, detalle mínimo) |
| El enlace se reenvía fuera de Armotor | Quien no tenga la clave ve "Enlace no válido" | Clave en el enlace, cambiable por el administrador; límite de envíos por minuto |
| El asesor no aparece en la lista | "No estoy en la lista" con instrucción de avisar al coordinador | Lista de comerciales administrable; la de taller ya existe en el CRM |
| No hay asesores CC activos para la rotación | "Radicado, pendiente de asignación" | El caso se crea igual y el coordinador lo reparte (panel Equipo en rotación) |
| El chat de Google no responde | Caso radicado normalmente | El caso queda en el CRM; la publicación en el chat no bloquea el registro |
| Lista de asesores desactualizada en el celular | Lista recargada al abrir | Las listas se piden al servidor cada vez que se abre el formulario |
