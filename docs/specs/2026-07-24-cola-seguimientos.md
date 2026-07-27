# Cola de seguimientos

> Spec funcional · CRM CETA Armotor · 2026-07-24 · Estado: Aprobada

## 1. Overview
Una nueva vista "Seguimientos" en el menú del CRM muestra, ordenados y
priorizados, todos los seguimientos comprometidos con clientes: primero los
vencidos (en rojo) y luego los del día y los próximos. Un contador en el
menú y un aviso en el Home recuerdan al asesor cuántos tiene pendientes.
Cada seguimiento se atiende con un clic que lo abre en el Panel de Cierre
para re-tipificarlo — así ningún "llámeme mañana a las 2" vuelve a perderse.

## 2. Usuarios Objetivo
- **Asesores de call center y digitales:** ven y trabajan SU propia cola
  (los seguimientos de sus gestiones), con contador y aviso al entrar. Son
  los usuarios principales, varias veces al día.
- **Administrador, coordinador y analista:** ven la cola COMPLETA del equipo
  y pueden **gestionar y reasignar cualquier seguimiento** desde la cola
  (no solo lectura), para que nada se venza aunque el dueño no esté.
- **Volumen esperado:** 10–40 seguimientos activos en total, consultados por
  cada asesor 3–5 veces al día.

## 3. Contexto del Problema
Hoy el seguimiento queda bien guardado (fecha y hora comprometidas con el
cliente), pero NO existe ningún lugar que los muestre como cola de trabajo:
el asesor tendría que abrir Control de Gestión, filtrar por "Seguimiento" y
revisar caso por caso cuál toca hoy. Ejemplo real: el cliente de la placa
ABC123 pidió "llámeme el 24 a la 1:20 pm"; si ese día el asesor no recuerda
buscarlo, la llamada no ocurre, el cliente percibe incumplimiento y la cita
potencial se pierde. La fecha de seguimiento ya se captura de forma
confiable — falta convertirla en una cola que trabaje para el asesor.

## 4. Alcance
**Incluye:**
- Vista "Seguimientos" en el menú (sección Gestión) con la cola ordenada:
  vencidos primero (marcados en rojo con cuánto llevan vencidos), luego los
  de hoy y los próximos, cada uno con cliente, placa, teléfono, fecha/hora
  comprometida y la observación del seguimiento.
- Contador (badge) en el menú con los seguimientos vencidos + los de hoy.
- Aviso en el Home al entrar: "Tienes N seguimientos para hoy (M vencidos)"
  con clic directo a la cola.
- Botón "Gestionar en el panel →" en cada seguimiento: abre el caso en el
  Panel de Cierre para re-tipificarlo; al guardarse con un nuevo resultado,
  el seguimiento sale de la cola y los contadores bajan. Si el cliente pide
  otra fecha, se tipifica Seguimiento otra vez con la fecha nueva (queda en
  el historial) y el caso vuelve a la cola con la fecha actualizada.
- La cola es COMPLETA: lee directamente de la base, sin depender del tope
  de las últimas gestiones cargadas.

**No incluye:**
- Reprogramar la fecha desde la cola sin gestionar (decisión: el único
  camino de gestión es el Panel de Cierre).
- Alertas al grupo de Google Chat por seguimientos vencidos (se decidió no
  incluirla por ahora; puede sumarse luego reutilizando el bot).
- Recordatorios por correo o notificaciones del navegador.
- Seguimientos de leads comerciales del calificador (solo gestiones del
  panel en esta versión).

## 5. Comportamiento Esperado

**Flujo 1 — Trabajar la cola (principal):**
1. El asesor entra al CRM y ve en el Home: "Tienes 3 seguimientos para hoy
   (1 vencido)". Los roles de supervisión lo ven en plural: "El equipo
   tiene N seguimientos para hoy (M vencidos)". El menú muestra
   "Seguimientos" con un badge rojo "3".
2. Hace clic y llega a la cola: arriba el vencido en rojo ("vencido hace
   2 días"), luego los de hoy con su hora, luego los próximos.
3. En cada tarjeta ve: nombre, placa, teléfono, fecha/hora comprometida y
   la nota del seguimiento ("cliente pidió cotización de rines").
4. Pulsa "Gestionar en el panel →": el panel se precarga con los datos del
   caso (incluido el km ya capturado) y el asesor llama al cliente.
5. Tipifica el resultado (ej. Agendado) y guarda: el caso sale de la cola,
   el badge baja, y el historial registra toda la cadena.

**Flujo 2 — El cliente pide otra fecha:**
1. Desde la cola, el asesor gestiona el caso y el cliente dice "mejor el
   viernes".
2. Tipifica Seguimiento de nuevo con la fecha del viernes y guarda.
3. El caso reaparece en la cola con la fecha nueva y el compromiso queda
   trazado en el historial.

**Flujo 3 — Cola vacía:**
1. Si no hay seguimientos vencidos ni de hoy, el badge no aparece y la
   vista muestra "No tienes seguimientos pendientes" con los próximos (si
   los hay) en una lista secundaria.

**Criterio de éxito (prueba de Pablo):** crear un seguimiento para hoy y
otro con fecha pasada → la cola los muestra ordenados con el vencido en
rojo y el badge marca 2 → gestionar uno desde la cola → desaparece y el
badge baja a 1.

## 6. Posibles Errores y Mitigación

| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión al abrir la cola | La cola muestra lo último conocido con aviso de "sin conexión" | La vista revalida sola al volver la conexión; los contadores nunca inventan datos |
| Falla el guardado al gestionar | El formulario del panel NO se limpia y aparece "reintenta" | Regla del proyecto: borrador conservado; el seguimiento sigue en la cola hasta que el guardado sea exitoso |
| Seguimiento sin hora (solo fecha) | Aparece en la cola como "durante el día" | La fecha sola basta para entrar a la cola del día; la hora es opcional |
| Dos asesores miran el mismo caso | Cada asesor ve su cola; puede gestionarlo el dueño o un rol de supervisión | Un asesor que no es dueño lo abre en solo lectura; supervisión (admin/coordinador/analista) puede gestionar y reasignar cualquiera |
| Usuario sin permiso | Los roles sin acceso no ven la vista en el menú | Mismo esquema de permisos por rol de las demás vistas |
| Datos viejos en caché | El contador puede tardar unos segundos en actualizarse al entrar | La cola consulta directo a la base al abrir la vista y revalida con el patrón ya probado |
