# Ingesta automática de leads Meta a casos internos

> Spec funcional · CRM CETA Armotor · 2026-08-21 · Estado: Aprobada

## 1. Overview
Los leads que Meta (Facebook/Instagram) deposita en las dos hojas de Drive
—"Armotor 2024 - Posventa-taller" (KIA) y "Posventa Honda 2025"— entran
solos al CRM como **casos internos**, asignados con las mismas reglas de
rotación del equipo, en dos cortes diarios (8:00 am y 3:00 pm). El asesor
recibe el caso en su bandeja y el grupo de chat de la sede se notifica
como con cualquier caso interno.

## 2. Usuarios Objetivo
- **Asesores CC:** reciben los casos por rotación y los gestionan como
  cualquier caso interno. Volumen actual: 3–6 leads/día entre ambas hojas.
- **Coordinación:** ve los casos en bandeja/Control; puede reasignar.
- Nadie digita nada: la carga es 100% automática.

## 3. Contexto del Problema
Hoy los leads quedan en las hojas de Drive y alguien debe revisarlas y
transcribirlos a mano — se pierden horas frente a la meta de contacto de
menos de 2 horas, y leads enteros se quedan sin gestionar.

## 4. Alcance
- **Incluye:**
  - Lectura automática de ambas hojas (compartidas con enlace de solo
    lectura) en dos cortes: 8:00 am y 3:00 pm, hora Colombia.
  - Carga inicial de los leads desde el **21 de agosto de 2026**.
  - Cada lead nuevo crea UN caso interno (sin duplicar si el corte se
    repite: el id del lead de Meta queda registrado).
  - **Marca especial de lead**: tipo de radicación "Lead"; el caso carga
    el teléfono (crea/reutiliza el cliente), y la placa y el vehículo van
    EN LA NOTA para que el asesor los valide y diligencie al llamar — un
    lead no es información verificada, así que no crea vehículos.
  - Asignación con las mismas reglas: rotación en bloques de 5 entre
    asesores CC activos por cola A/B (la propiedad por placa no aplica
    porque el lead no trae placa confiable).
  - Tipo de servicio por campaña: tapetes/accesorios/cover dog →
    Accesorios (A) · colisión → Especializada (B) · mantenimiento/
    preventivo/posventa/filtros → Mantenimiento (A). La campaña original
    queda en la nota.
  - Ciudad del lead → sede (armenia→Armenia, etc.); la notificación al
    grupo de chat de la sede sale con el flujo ya existente.
  - Se descartan: leads de prueba de Meta y filas sin teléfono utilizable.
- **No incluye:**
  - Respuesta automática al cliente del lead.
  - Leads comerciales (venta de vehículos) — solo estas 2 hojas posventa.
  - Sincronizar cambios posteriores de la hoja (solo se leen leads nuevos).

## 5. Comportamiento Esperado
1. Meta deja un lead a las 9:15 am → en el corte de las 3:00 pm se crea el
   caso: cliente por teléfono, nota "📣 LEAD META (KIA · campaña) —
   VALIDAR DATOS AL CONTACTAR // Placa indicada: X // Vehículo: Y //
   Correo: Z", asignado por rotación, chat de la sede notificado.
2. El asesor lo ve en su bandeja de casos internos, llama, valida la placa
   real y gestiona desde el panel como siempre (al tipificar, la placa que
   digite crea/actualiza el vehículo con datos ya verificados).
3. Si el corte corre dos veces o la hoja se relee, el lead NO se duplica.
4. **Criterio de éxito:** tras compartir las hojas, la carga inicial trae
   los leads desde el 21/08; un lead nuevo aparece como caso asignado en
   el corte siguiente, con su marca de Lead y su nota completa.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| La hoja deja de estar compartida | No entran leads nuevos | El corte siguiente los recoge al restaurar el acceso (nada se pierde: la hoja conserva todo) |
| Lead sin teléfono o de prueba | No crea caso | Se descarta y queda contado en la respuesta del corte |
| Ciudad no reconocida | Caso sin sede, notifica al grupo "Otros" | El asesor corrige la ciudad al gestionar |
| Corte falla (Meta/Google caído) | Nada visible | El siguiente corte recoge todo lo pendiente (ingesta por id, sin duplicar) |
| Mismo cliente con varios leads | Cada lead crea su caso (contactos distintos) | El aviso de caso abierto por placa no aplica; el asesor ve el historial del teléfono en la ficha |
