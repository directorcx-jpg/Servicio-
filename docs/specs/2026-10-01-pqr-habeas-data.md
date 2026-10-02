# Registro de PQR de Habeas Data con exporte al área de datos

> Spec funcional · CRM CETA Armotor · 2026-10-01 · Estado: Aprobada

## 1. Overview

Cuando un cliente ejerce sus derechos sobre sus datos personales (pide que
no lo llamen más, que corrijan o eliminen su información, que le muestren
qué datos tiene la compañía, etc.), el asesor debe dejar ese reclamo
registrado de forma completa y estandarizada. Este desarrollo agrega al
panel de cierre un bloque de "Habeas Data" con las causales definidas por
el asesor jurídico, guarda cada PQR con los datos del titular y la
respuesta dada, y alimenta automáticamente —cada hora— el Google Sheet que
usa el área de tratamiento de datos para sus reportes ante la SIC.

## 2. Usuarios Objetivo

- **Asesores CC (5) y asesores digitales (2):** registran la PQR durante la
  gestión, sin salir del panel de cierre. Volumen esperado: 1 a 5 PQR por
  semana en total (hoy "No contactar" aparece ~10 veces al mes).
- **Coordinador / administrador:** ven las PQR pendientes de respuesta en
  Control de Gestión, con el semáforo de días para no incumplir los
  términos legales, y pueden registrar la respuesta al titular.
- **Analista:** solo consulta.
- **Área de tratamiento de datos (externa al CRM):** NO entra al CRM; ve el
  Google Sheet que se actualiza solo, y completa allí las columnas que el
  call center no captura (cédula y correo del titular cuando falten).

## 3. Contexto del Problema

Hoy, cuando un cliente dice "no me llamen más" o "corrijan mi teléfono", el
asesor tipifica No contactar o Actualizar datos y sigue; no queda registro
de la causal exacta, ni de qué se le respondió al titular, ni cuándo. El
asesor jurídico (García Maya & Asociados) requirió formalmente un registro
estandarizado con campos mínimos (titular, fecha de recepción, medio,
descripción, respuesta y fecha de respuesta) porque la compañía debe
reportar las PQR de Habeas Data ante la SIC. Además, 5 de las 8 causales
que definió el jurídico (eliminación de datos, consulta de datos, prueba de
la autorización, datos asociados a un vehículo, contacto sin autorización)
hoy no tienen dónde registrarse: se pierden en la observación libre.

## 4. Alcance

**Incluye:**
- Bloque "PQR Habeas Data" dentro del panel de cierre que se despliega
  automáticamente al tipificar **No contactar** o **Actualizar datos**, y
  que también puede activarse a mano en cualquier otra gestión (el cliente
  agenda su cita Y pide consultar sus datos, por ejemplo).
- Campos del bloque: **causal** (las 8 del jurídico), **medio** (llamada,
  WhatsApp, correo, presencial — propuesto según el origen de la gestión),
  **descripción de la solicitud**, **respuesta dada al titular** y si quedó
  **resuelta en la llamada o pendiente**.
- Datos del titular tomados de la misma gestión: nombre, teléfono y placa.
  La cédula y el correo quedan como columnas para que el área de datos las
  complete en el sheet (si el CRM los tiene, van precargados).
- **Google Sheet que se actualiza solo cada hora**: Pablo crea el sheet y lo
  comparte con el área; el sheet consulta el CRM y AGREGA las PQR nuevas
  como filas (nunca reescribe las existentes, para no borrar lo que el área
  complete a mano). Columnas en el orden pedido por el jurídico: nombre,
  cédula, correo, fecha de recepción, año, semestre, medio, descripción,
  respuesta, fecha de respuesta — más placa, teléfono, causal, ciudad y
  asesor como apoyo.
- Bloque "PQR Habeas Data" en Control de Gestión: pendientes de respuesta
  con días hábiles transcurridos y semáforo de términos SIC (consultas: 10
  días hábiles; reclamos: 15), y botón para registrar la respuesta y
  cerrarla.

**No incluye (por ahora):**
- Captura de PQR que llegan por fuera del call center (correo directo al
  área, carta física): el área las sigue registrando a mano en su sheet.
- Gestión documental de soportes (cartas, autorizaciones adjuntas).
- Supresión automática del cliente en las bases de marcación (el "No
  contactar" existente ya lo excluye de la gestión del CRM; depurar las
  bases de campañas externas sigue siendo proceso del analista).
- Reportes semestrales ante la SIC (los arma el área con su sheet).

## 5. Comportamiento Esperado

**Flujo principal — el cliente pide no ser contactado:**
1. El asesor atiende la llamada y tipifica **No contactar** en el punto 2
   del panel.
2. Debajo de la tipificación aparece el bloque "PQR Habeas Data" ya
   activado, con la causal propuesta "No autoriza contacto comercial" (la
   puede cambiar por cualquiera de las 8) y el medio propuesto según el
   canal de la gestión.
3. El asesor escribe la descripción ("cliente solicita que no lo llamen
   más desde ningún número de Armotor") y la respuesta dada ("se le
   informa que será excluido de las campañas en un plazo máximo de 15
   días"). Marca "Resuelta en la llamada".
4. Guarda la gestión como siempre. La PQR queda registrada con fecha y
   hora, ligada a la gestión y al cliente.
5. A más tardar una hora después, la PQR aparece como fila nueva en el
   Google Sheet del área de datos, con año y semestre calculados.

**Flujo alterno — solicitud que no es "No contactar":**
1. El cliente agenda su mantenimiento y además pide saber qué datos suyos
   tiene la compañía.
2. El asesor tipifica **Agendado** normal y activa a mano el check
   "Registrar PQR Habeas Data"; el bloque se despliega con la causal
   "Consulta de datos".
3. Como la consulta no se resuelve en la llamada, marca "Queda pendiente".
   La PQR nace abierta.

**Flujo alterno — respuesta posterior (PQR pendiente):**
1. El coordinador abre Control de Gestión y ve el bloque "PQR Habeas Data":
   las pendientes con los días hábiles corriendo (verde hasta el día 5,
   ámbar hasta el 9, rojo del 10 en adelante para consultas; 15 para
   reclamos).
2. Cuando el área de datos o el asesor dan la respuesta al titular, el
   coordinador hace clic en "Responder", escribe la respuesta y la fecha
   queda registrada. La fila del sheet se completa sola en la siguiente
   actualización horaria (solo los campos de respuesta, sin tocar lo que
   el área haya escrito en cédula/correo).

**Flujo del área de datos (fuera del CRM):**
1. El área abre su Google Sheet en cualquier momento: las PQR del CRM
   están como filas, cada una con su número consecutivo.
2. Completa a mano cédula y correo cuando falten. Sus ediciones no se
   pierden con las actualizaciones horarias.

**Criterio de éxito (prueba de Pablo):**
1. Registrar una PQR de prueba tipificando No contactar → verla en el
   bloque de Control → verla aparecer en el sheet antes de una hora con
   año/semestre correctos → completar cédula a mano en el sheet → esperar
   la siguiente actualización y confirmar que la cédula sigue ahí →
   responder la PQR desde Control y ver la fecha de respuesta llegar al
   sheet.

> Nota técnica: tabla nueva `pqr_habeas_data` en Supabase (fk a gestión y
> cliente, snapshot del titular); Edge Function `exportar-pqr` (GET con
> secreto, mismo patrón de las ingestas) que entrega las PQR en JSON; Apps
> Script dentro del sheet con disparador horario que agrega filas nuevas
> por id y solo actualiza las columnas de respuesta; el bloque del panel
> reutiliza el semáforo de completitud (causal y descripción obligatorias
> cuando el bloque está activo).

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Falla el guardado (sin conexión) | El formulario NO se limpia; toast de reintento | Regla vigente del proyecto: borrador de seguridad; la PQR viaja dentro del mismo guardado de la gestión (una sola transacción) |
| Asesor tipifica No contactar pero no llena la causal | El botón de guardar se bloquea: "Falta: Causal Habeas Data" | Semáforo de completitud; la descripción también es obligatoria con el bloque activo |
| El cliente no suministra cédula/correo | La PQR se guarda igual con nombre, teléfono y placa | Columnas quedan vacías en el sheet para que el área de datos las complete (acordado con Pablo) |
| El área edita el sheet y teme que se borre | Nada se pierde | El sheet solo AGREGA filas nuevas y actualiza únicamente las columnas de respuesta, identificando cada fila por su id |
| Se registra dos veces la misma solicitud | Dos filas en el sheet | El bloque de Control muestra PQR del mismo teléfono juntas; el área puede marcar duplicados; no se bloquea (dos llamadas reales pueden traer dos solicitudes) |
| PQR pendiente se pasa del término legal | Fila en rojo en el bloque de Control | Semáforo de días hábiles (10/15) visible para coordinador y administrador |
| El sheet deja de actualizarse (falla del disparador) | Datos viejos en el sheet | La hoja muestra la fecha/hora de la última actualización en una celda fija; si pasa de 2 horas, el área avisa y se revisa el disparador |
| Usuario sin permiso intenta ver el bloque de Control | No le aparece | Permisos existentes de Control de Gestión |
