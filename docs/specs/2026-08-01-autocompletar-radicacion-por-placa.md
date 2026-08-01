# Autocompletar la radicación de casos internos por placa

> Spec funcional · CRM CETA Armotor · 2026-08-01 · Estado: Aprobada

## 1. Overview
Al radicar un caso interno, escribir la placa bastará para que la plataforma
busque la ficha del cliente y complete sola el nombre, el teléfono y la
ciudad. El asesor solo verifica (y corrige si algo cambió) en lugar de
digitar todo de cero. Menos tiempo por caso y menos errores de digitación.

## 2. Usuarios Objetivo
- **Asesores de call center (asesor_cc) y coordinación:** son quienes
  radican casos internos a diario (solicitudes que llegan por los grupos de
  chat de taller). Uso estimado: 10–30 radicaciones al día entre todos.
- No cambia permisos: quien hoy puede radicar, puede usar el autocompletado.

## 3. Contexto del Problema
Hoy, cuando llega una solicitud por chat para reagendar o gestionar un
cliente que YA existe en la plataforma (por ejemplo los 1.263 del histórico
de julio, o cualquier gestión anterior), el asesor debe volver a digitar
nombre, teléfono y ciudad mirando el chat. Eso son 30–60 segundos perdidos
por caso y riesgo de escribir un teléfono distinto, lo que crearía una
ficha de cliente aparte (el cliente se identifica por teléfono).

## 4. Alcance
- **Incluye:**
  - En el formulario "Radicar caso interno", al terminar de escribir la
    placa (salir del campo o pausa breve), la plataforma busca el vehículo.
  - Si existe: rellena nombre, teléfono y ciudad con los datos de la ficha
    y lo indica con un aviso discreto ("Datos traídos de la ficha de
    GXR991"). Los campos quedan editables.
  - Si el asesor ya había escrito algo en un campo, NO se le sobreescribe.
  - Si la placa no existe: todo sigue como hoy (digitación manual).
  - Funciona junto con la advertencia de caso abierto que ya existe.
- **No incluye:**
  - Autocompletar en el Panel de Cierre (ya tiene su propio buscador 360).
  - Botón "Reagendar" directo desde la ficha del cliente (mejora futura).
  - Búsqueda por teléfono en la radicación (la llave del flujo es la placa).

## 5. Comportamiento Esperado
1. **Flujo principal — placa conocida:**
   1. El asesor abre Casos internos → Radicar caso, y escribe `GXR991`.
   2. Al salir del campo, aparecen solos el nombre, el teléfono y la
      ciudad de la ficha, con el aviso "Datos traídos de la ficha".
   3. El asesor revisa, ajusta el tipo de servicio y la nota, y pulsa
      "Radicar y asignar". El caso queda igual que uno digitado a mano.
2. **Flujo alterno — placa nueva:** escribe una placa sin ficha; no pasa
   nada visible y digita los datos como siempre.
3. **Flujo alterno — datos ya escritos:** si el asesor escribió primero el
   nombre y luego la placa, el nombre escrito se respeta (solo se llenan
   los campos vacíos).
4. **Criterio de éxito (prueba de Pablo):** radicar un caso con la placa
   de un cliente del histórico de julio y comprobar que nombre, teléfono y
   ciudad aparecen solos y el caso queda bien creado y asignado.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión al buscar la placa | Nada cambia: los campos siguen vacíos y se digitan a mano | La búsqueda falla en silencio; radicar sigue funcionando igual |
| La ficha tiene nombre provisional ("CLIENTE GXR991") | Se autocompleta ese nombre y el asesor lo corrige con el real | Al guardar, el nombre corregido actualiza la ficha (comportamiento actual) |
| Placa con varias fichas/teléfonos históricos | Se usa el cliente vinculado actualmente al vehículo | La ficha 360 conserva todo el historial por placa |
| El asesor escribe la placa con espacios o minúsculas | Se normaliza sola (mayúsculas, sin espacios) | Normalización ya existente en la radicación |

---
Verificada 2026-08-01 (v1.21.0): 7/10 PASA (carga sin errores, módulos,
búsqueda por placa del histórico devuelve nombre/teléfono/ciudad — GXR991,
ficha sin ciudad solo llena nombre/teléfono — LES298, placa inexistente no
hace nada, regresión del aviso de duplicado y del limpiado del formulario).
3 casos requieren sesión de Pablo: no sobreescribir campos ya escritos,
aviso visual "Datos traídos de la ficha", y comportamiento sin conexión.
