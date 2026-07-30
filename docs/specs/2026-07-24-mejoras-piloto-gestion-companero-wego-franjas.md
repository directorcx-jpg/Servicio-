# Mejoras del piloto: "Gestión de compañero", We Go agendados y franjas

> Spec funcional · CRM CETA Armotor · 2026-07-24 · Estado: Aprobada
> (decisiones tomadas por Pablo en el brainstorming del mismo día)

## 1. Overview
Paquete de cuatro mejoras nacidas del piloto: un nuevo resultado "Gestión de
compañero" para registrar rápido los contactos que otro asesor ya realizó;
una vista de We Go agendados en Control Gestión con advertencia al agendar
para no duplicar franjas; las franjas horarias reales de la operación
(7:10 a. m. a 5:50 p. m., cada 20 minutos); y la opción "Otros" en el grupo
de chat de radicación.

## 2. Usuarios Objetivo
- **Asesores (cc y digitales):** usan el resultado nuevo y las franjas a
  diario; ven la advertencia de We Go al agendar.
- **Todo el equipo:** consulta la vista de We Go agendados en Control
  Gestión (los asesores también la ven — necesitan saber qué franjas están
  ocupadas aunque su Control sea de gestiones propias).
- Volumen: el resultado nuevo ~5–15 veces/día; We Go ~5–10 agendas/día.

## 3. Contexto del Problema
(1) Cuando un cliente ya fue contactado por otro compañero, el asesor no
tiene cómo tipificarlo rápido: termina forzando otra categoría y dañando
las métricas. (2) Los We Go se agendan a ciegas: dos asesores pueden citar
recogidas en la misma ciudad y franja, y el conductor no alcanza. (3) Las
franjas actuales (7:00 en punto) no corresponden a la operación real, que
arranca 7:10 y trabaja cada 20 minutos. (4) Hay solicitudes que llegan por
canales que no son los 6 grupos de chat.

## 4. Alcance
**Incluye:**
- Resultado **"Gestión de compañero"** como categoría propia (pill en el
  panel, color y etiqueta en todas las tablas y filtros, categoría real en
  la base para reportes). Campos exigidos: solo nombre, placa y una
  **observación obligatoria** que referencia la gestión del compañero;
  exento de kilometraje; sin secciones de cotización, cita ni We Go.
  Tipificación Evolution: CONTACTO · "GESTIONADO POR COMPAÑERO".
- **Vista "We Go agendados"** en Control Gestión: los próximos We Go
  agrupados por día → ciudad → franja, con placa, cliente y quién recoge.
- **Advertencia al agendar** (no bloqueante): al elegir fecha+hora de We Go
  en el panel, si ya existe otro We Go en esa ciudad/fecha/franja aparece
  "⚠️ Ya hay un We Go a las HH:MM en [ciudad]" consultando la base en vivo.
  El asesor puede continuar si es un caso legítimo.
- **Franjas 7:10 → 17:50 cada 20 min** en TODOS los campos de hora (cita en
  taller, We Go y seguimiento).
- Opción **"Otros"** en "Grupo de chat origen" al radicar (sin alerta de
  chat asociada, por diseño).

**No incluye:**
- Bloqueo duro del doble agendamiento (descartado: hay casos legítimos).
- Enlace formal a la gestión previa del compañero (la observación basta).
- Gestión de capacidad por conductor/vehículo de We Go (futuro si crece).

## 5. Comportamiento Esperado
1. **Gestión de compañero:** el asesor atiende la llamada, ve en la ficha/
   historial que un compañero ya gestionó, elige la pill "Gestión de
   compañero", escribe la observación ("agendado por Karen el 24/7 — placa
   ABC123") y guarda. El semáforo solo exige nombre, placa y observación.
   En Control Gestión aparece con su propia etiqueta y color.
2. **We Go sin choques:** antes de ofrecer una franja, el asesor abre
   Control Gestión → "We Go agendados" y ve el mapa del día por ciudad. Si
   de todos modos elige una franja ocupada, el panel se lo advierte en el
   momento, sin impedirle guardar.
3. **Franjas:** todos los selects de hora ofrecen 7:10, 7:30, 7:50 … 17:50.
4. **Criterio de éxito (prueba de Pablo):** (a) guardar una "Gestión de
   compañero" solo con nombre+placa+observación y verla tipificada en
   Control; (b) agendar un We Go y verlo en la vista; intentar otro en la
   misma ciudad/franja y recibir la advertencia; (c) abrir cualquier select
   de hora y ver que inicia 7:10 y termina 17:50.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Falla el guardado | Formulario intacto + "reintenta" (regla del proyecto) | Borrador conservado |
| Sin conexión al verificar franja | La advertencia no aparece (no inventa) | La verificación es en vivo; si falla, el asesor consulta la vista de We Go |
| Citas viejas con horas fuera de la grilla (7:00, 18:00) | Se muestran tal cual en tablas y vistas | Los selects conservan el valor previo aunque no esté en la grilla nueva |
| Dos asesores agendan la misma franja a la vez | Ambos ven la advertencia si el otro ya guardó | Ventana de carrera mínima aceptada (advertencia, no bloqueo) |
| "Otros" como grupo de origen | El caso se crea normal, sin alerta al chat | El bot solo notifica grupos con webhook (diseño existente) |
