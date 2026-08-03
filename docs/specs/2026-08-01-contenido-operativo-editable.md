# Contenido operativo editable (Fase 2 · Entrega 1)

> Spec funcional · CRM CETA Armotor · 2026-08-01 · Estado: Aprobada

## 1. Overview
Las campañas, la ruta de escalamiento, las extensiones, los clientes VIP,
el pico y placa y los artículos de la Base de Conocimiento dejarán de vivir
"pegados" en el código y pasarán a la base de datos, con un editor dentro
del CRM. El coordinador o el administrador podrán crear, corregir,
desactivar o reactivar cualquier entrada y el equipo verá el cambio al
instante en todos los computadores, sin esperar un despliegue. Primera
entrega de la Fase 2 del roadmap.

## 2. Usuarios Objetivo
- **Coordinador y administrador (2 personas):** editan el contenido desde
  el CRM (crear, editar, desactivar/reactivar). El borrado definitivo es
  solo del administrador. Uso estimado: 5–15 ediciones al mes
  (principalmente campañas y tarifas).
- **Asesores (cc y digital) y analista:** consultan igual que hoy — las
  mismas vistas de la Base de Conocimiento, campañas, VIP, etc. No ven
  ningún botón de edición.
- Nadie pierde nada: las vistas actuales se conservan tal cual, solo cambia
  de dónde sale la información.

## 3. Contexto del Problema
Hoy, si cambia el descuento de una campaña o el teléfono de una sede, hay
que pedirle el cambio al desarrollador, editar el código y esperar el
despliegue. Ejemplo real del piloto: la campaña "Total Confianza KIA" vence
el 31 de agosto — al día siguiente los asesores la seguirán viendo vigente
hasta que alguien la quite del código. El permiso de "editar contenido" del
coordinador existe en el sistema desde el inicio pero no tiene ninguna
pantalla detrás. Con el call center ya operando en la plataforma, el
contenido desactualizado se convierte en información errónea dicha al
cliente.

## 4. Alcance
- **Incluye:**
  - Seis tipos de contenido pasan a ser editables: **campañas,
    escalamiento, extensiones, clientes VIP, pico y placa y artículos de la
    Base de Conocimiento**.
  - Una sección nueva "Editar contenido" (visible solo para coordinador y
    administrador) con la lista de entradas por tipo: buscar, crear,
    editar, desactivar y reactivar.
  - Desactivar oculta la entrada a los asesores sin borrarla; el borrado
    definitivo solo lo puede hacer el administrador.
  - Cada entrada muestra quién la modificó por última vez y cuándo, y un
    registro de cambios consultable (qué campo cambió, quién y cuándo).
  - Los asesores ven el contenido actualizado al recargar o cambiar de
    vista, en cualquier sede y dispositivo, sin despliegues.
  - Si no hay conexión con la base, la app muestra la última copia
    conocida (y si nunca ha cargado, el contenido de fábrica del código).
  - Migración inicial: todo el contenido actual queda cargado en la base
    tal como está hoy, sin pérdida.
- **No incluye:**
  - Plantillas de WhatsApp (Entrega 2) y guiones/flujos Inbound, Outbound y
    calificador de leads (Entrega 3) — siguen en el código por ahora.
  - Sedes, asesores de taller, listas del panel y configuración del
    cotizador: conservan su manejo actual.
  - Aprobaciones en dos pasos (quien edita publica directo).
  - Fotos o archivos adjuntos en las entradas (solo texto y campos).

## 5. Comportamiento Esperado
1. **Flujo principal — actualizar una campaña:**
   1. El coordinador abre la sección "Editar contenido" del sidebar y elige
      el tipo "Campañas". Ve la lista con su estado (activa/inactiva) y
      quién tocó cada una por última vez.
   2. Entra a "Total Confianza KIA", corrige la vigencia y guarda. El
      sistema registra el cambio con su nombre, fecha y hora.
   3. Un asesor en Manizales recarga o cambia de vista y ya ve la campaña
      corregida en su Base de Conocimiento.
2. **Flujo — desactivar una campaña vencida:** el coordinador la apaga con
   un interruptor; para los asesores desaparece de inmediato de las vistas.
   Si la promoción vuelve, la reactiva sin re-digitarla.
3. **Flujo — crear un artículo nuevo:** botón "Nueva entrada" → elige el
   tipo, llena los campos (título, categoría, contenido...) y guarda; queda
   activa y visible para el equipo.
4. **Flujo — consultar el registro de cambios:** dentro de una entrada,
   pestaña "Historial": lista de cambios (quién, cuándo, qué campo pasó de
   qué valor a cuál).
5. **Flujo — borrado definitivo (solo administrador):** dentro de la
   entrada, opción "Eliminar" con confirmación explícita; desaparece de la
   lista y del historial visible.
6. **Criterio de éxito (prueba de Pablo):** editar la vigencia de una
   campaña desde su usuario, verificarla actualizada en el navegador de un
   asesor sin redeploy; desactivarla y verificar que desaparece para el
   asesor; consultar el historial y ver ambos cambios registrados.

## 6. Posibles Errores y Mitigación
| Situación | Qué ve el usuario | Mitigación |
|---|---|---|
| Sin conexión al guardar una edición | Aviso "No se pudo guardar — reintenta"; el formulario conserva lo escrito | El editor no se limpia; se reintenta al recuperar conexión |
| Sin conexión al consultar | El contenido de la última carga (o el de fábrica si nunca cargó) | Caché local de lectura; aviso discreto de "datos sin refrescar" |
| Dos personas editan la misma entrada | Gana el último en guardar; el historial muestra ambos cambios | El registro de cambios permite reconstruir y corregir |
| Asesor intenta entrar al editor | No ve la sección en el sidebar; si llega por URL, pantalla de "sin acceso" | Permiso `editarContenido` (coordinador/admin) validado también en la base de datos |
| Entrada duplicada (mismo título y tipo) | Aviso al guardar: "Ya existe una entrada con este título" | Validación al crear; se permite continuar solo confirmando |
| Se borra algo por error | Solo el administrador puede borrar definitivo, con confirmación | Para lo demás existe desactivar, que es reversible |

---
Verificada 2026-08-01 (v1.22.0, parcial): PASA en local — carga sin errores
de consola, módulos OK, migración `contenido_operativo_editable` con RLS
(lee todo el equipo, editan coordinador/admin, borra solo admin), seed de
55 entradas cargado (4 campañas, 16 escalamiento, 7 extensiones, 12 VIP,
2 pico y placa, 14 conocimiento) y round-trip del adaptador idéntico al
seed original en las 6 colecciones. Pendiente de sesión de Pablo (criterio
de éxito): editar campaña y verla actualizada donde un asesor, desactivar,
historial y borrado admin.
