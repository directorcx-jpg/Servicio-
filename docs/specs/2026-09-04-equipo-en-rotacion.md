# Equipo en rotación (control de asesores operativos)

> Spec funcional · CRM CETA Armotor · 2026-09-04 · Estado: Aprobada

## 1. Overview
El coordinador (y el administrador) pueden encender o apagar a cada asesor
CC desde Configuración. Un asesor apagado deja de recibir casos internos de
inmediato (vacaciones, licencia, retiro) y sus casos pendientes se pueden
repartir por rotación entre los demás con un clic. Reemplaza el proceso
manual de tocar Supabase y reasignar caso por caso.

## 2. Usuarios Objetivo
Coordinador y administrador (permiso `config`). Los asesores no ven esta
sección. Uso esperado: pocas veces al mes.

## 3. Contexto del Problema
El 04/09 Mille y Juan Diego fueron inactivados en Supabase, pero la rotación
siguió asignándoles casos: los bloques de 5 ya armados (en servidor y en el
navegador) no validaban contra la lista de activos. Además no existía forma
de que el coordinador hiciera este cambio sin acceso a Supabase, ni de
redistribuir los pendientes del asesor saliente sin reasignar uno a uno.

## 4. Alcance
**Incluye:** corrección de la rotación (servidor y front saltan inactivos al
asignar); sección "Equipo en rotación" en Configuración con switch Operativo
por asesor, contador de pendientes y botón "Repartir pendientes"; registro
en el historial de cada caso reasignado; reinicio de bloques al cambiar un
estado. **No incluye:** pausas programadas con fechas (vacaciones futuras) ni
gestión de usuarios_autorizados (sigue en Supabase).

## 5. Comportamiento Esperado
1. Coordinador abre Configuración → "Equipo en rotación": ve los asesores CC
   con su estado y cuántos pendientes tiene cada uno.
2. Apaga a un asesor → confirmación → desde ese momento ningún caso nuevo le
   llega (leads, no-ingresos, radicación manual). Aparece marcado "Inactivo".
3. Si el inactivo tiene pendientes, el botón "Repartir pendientes" los
   reasigna por rotación entre los activos; cada caso guarda en su historial
   "Reasignado por inactivación" y el chat del caso notifica el reasignado.
4. Encenderlo de nuevo lo mete al siguiente bloque de rotación.
5. Criterio de éxito: con un asesor apagado, 10 casos seguidos (manuales y
   automáticos) se reparten solo entre los activos; "Repartir pendientes"
   deja su bandeja en cero.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Usuario sin rol intenta cambiar estado | Error "Solo coordinador o administrador" | La validación vive en el servidor (RPC security definer) |
| Bloque del día armado antes del cambio | Nada — no se asigna al inactivo | Servidor y front validan al momento de entregar, no solo al barajar |
| Todos los asesores apagados | La asignación devuelve vacío y el caso queda sin asignar | Poco probable; el coordinador ve el estado completo en el panel |
| Sin conexión | "Disponible solo con conexión a Supabase" | Sección deshabilitada en local |
