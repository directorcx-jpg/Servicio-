# Filtro por fecha de radicación en Control de Gestión

> Spec funcional · CRM CETA Armotor · 2026-07-31 · Estado: Aprobada

## 1. Overview
El tablero de Control de Gestión tendrá un filtro por fecha de radicación
(desde/hasta) que trae de la base de datos TODO lo radicado en ese rango.
Los contadores, el balance de carga y la tabla reflejan el rango completo,
y cada fila muestra la fecha y hora en que se radicó la gestión. Así el
equipo puede responder preguntas como "¿qué se radicó el martes?" o "¿cuánto
agendó cada asesor esta semana?" con cifras confiables.

## 2. Usuarios Objetivo
- **Administrador (Pablo), coordinador y analista:** usan el filtro a
  diario para el control del equipo (revisión de la mañana y cierre del
  día). Son los mismos roles que hoy ven Control de Gestión.
- **Asesores (cc y digital):** no cambia nada para ellos; los roles que hoy
  no ven Control de Gestión siguen sin verlo.
- Volumen esperado: 3–4 personas, varias consultas al día con rangos de una
  a cuatro semanas.

## 3. Contexto del Problema
Hoy el tablero muestra las gestiones que están en la memoria del navegador,
que guarda solo las más recientes. Si Pablo quiere revisar lo radicado la
semana pasada, o comparar el volumen de un día específico, los números
pueden salir incompletos sin ninguna señal de alerta: parecería que un
asesor radicó 10 cuando en realidad fueron 25. Además, la fecha en que se
radicó cada gestión no siempre está visible, así que no hay forma rápida de
agrupar mentalmente "lo de hoy" vs "lo de ayer". Con el histórico de julio
ya importado, este control por fechas es la forma natural de auditar la
operación.

## 4. Alcance
- **Incluye:**
  - Selector de fechas desde/hasta (por fecha de radicación) en la barra de
    filtros de Control de Gestión, junto a Asesor y Resultado.
  - Al entrar a la vista, el rango arranca en los últimos 7 días.
  - Al cambiar el rango, la información se consulta directo a la base de
    datos: contadores (Total / Agendados / No contesta / Seguimiento),
    balance de carga por asesor, tabla de gestiones y gráficas reflejan el
    rango completo.
  - Columna "Radicado" visible en la tabla con fecha y hora de radicación.
  - Los filtros de Asesor y Resultado siguen funcionando combinados con el
    rango de fechas.
  - El botón "Limpiar" vuelve al rango por defecto (últimos 7 días).
- **No incluye:**
  - Cambios en el Modo TV ni en el Home (siguen como hoy).
  - Exportar a Excel/CSV el resultado del rango (posible mejora futura).
  - Paginación de la tabla: se muestra el rango completo con un tope de
    seguridad de 2.000 gestiones y aviso si se supera.
  - Filtros por sede u origen (se mantienen los actuales).

## 5. Comportamiento Esperado
1. **Flujo principal — revisar un rango:**
   1. Pablo abre Control de Gestión. El tablero carga con el rango
      "últimos 7 días" ya aplicado y visible en los dos campos de fecha.
   2. Cambia "Desde" al 01/07/2026 y "Hasta" al 15/07/2026. El tablero
      muestra un estado de carga breve y luego los contadores, el balance
      por asesor, la tabla y las gráficas de TODO lo radicado en esa
      quincena.
   3. En la tabla, cada gestión muestra su columna "Radicado" (ej:
      15/07 09:32), ordenada de la más reciente a la más antigua.
   4. Combina con el filtro de Asesor para ver solo lo de un asesor en el
      rango; los contadores se recalculan.
2. **Flujo alterno — volver al día a día:**
   1. Pulsa "Limpiar": los filtros de asesor/resultado se vacían y el
      rango vuelve a los últimos 7 días.
3. **Flujo alterno — registros importados:**
   1. Si el rango cubre julio, las gestiones del histórico importado
      aparecen en la tabla y en los contadores como cualquier otra (son
      parte de lo radicado), identificables porque su tipo de radicación
      es "Importado".
4. **Criterio de éxito (prueba de Pablo):** poner el rango 01/07/2026 –
   30/07/2026 sin más filtros y verificar que el Total coincide con lo
   radicado en julio (histórico importado + lo radicado en vivo), y que al
   filtrar por un asesor las cifras cuadran con las de ese asesor.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión o fallo de la consulta | Aviso "No se pudo consultar el rango" y el tablero conserva lo último que mostró | Se reintenta al cambiar cualquier filtro; no se borra nada de la pantalla |
| Rango invertido (desde > hasta) | Los campos se corrigen solos (se intercambian) y se consulta el rango corregido | Validación al elegir las fechas |
| Rango muy amplio con demasiados resultados | Aviso "El rango supera 2.000 gestiones, se muestran las más recientes" | Tope de seguridad en la consulta; se sugiere acortar el rango |
| Usuario sin permiso de Control de Gestión | La vista bloqueada de siempre ("Tu rol no tiene acceso") | Sin cambios: el filtro vive dentro de la vista ya protegida |
| Datos viejos en caché del navegador | El rango siempre se consulta a la base, no a la caché | El botón "Actualizar" repite la consulta del rango actual |

---
Verificada 2026-07-31 (v1.20.0): 6/10 PASA (carga sin errores, módulos,
total del rango 01/07–30/07 = 1.291 = 1.263 importadas + 28 en vivo,
cifras por asesor, tope no superado, regresión de permisos/vistas vecinas).
4 casos requieren sesión de Pablo en el sitio publicado: rango por defecto
7 días, rango invertido se corrige, columna "Radicado" visible, aviso ante
fallo de consulta.
