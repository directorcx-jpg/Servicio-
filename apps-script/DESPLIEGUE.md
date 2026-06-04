# Guía de despliegue — Apps Script CETA

> Sigue estos pasos UNA vez. Al terminar tendrás una URL `/exec` que pegas
> en la Consola (Configuración → Conexión Apps Script) y activa todo.

---

## PASO 1 — Crear la hoja de gestiones

1. Entra a https://drive.google.com con tu cuenta `directorcx@armotor.com`.
2. **Nuevo → Hojas de cálculo de Google**.
3. Ponle el nombre exacto: **`CETA_Gestiones_2026`**.
4. Mira la URL del navegador. Se ve así:
   `https://docs.google.com/spreadsheets/d/`**`1A2b3C4d5E6f...XyZ`**`/edit`
   Ese código largo entre `/d/` y `/edit` es el **ID**. Cópialo.
   *(No necesitas crear columnas ni pestañas: el script las crea solo.)*

---

## PASO 2 — Dar acceso al libro del cotizador

El cotizador lee el libro **`Kits Kia`** (ID ya configurado: `1B0vYkjXKJ1BDv0O9SbVKbzkPZidpUrqlY2XKs7mCl3c`).
Asegúrate de que tu cuenta tenga acceso de **lectura** a ese libro
(si lo creaste tú o ya lo abres normal, no hay que hacer nada).

---

## PASO 3 — Crear el proyecto Apps Script

1. Entra a https://script.google.com → **Nuevo proyecto**.
2. Borra el contenido de ejemplo del editor.
3. Abre el archivo `apps-script/Code.gs` de este repositorio, **copia TODO** y
   pégalo en el editor de Apps Script.
4. Arriba en el código, en el bloque `var CFG = {`, reemplaza:
   ```
   GESTIONES_SHEET_ID: 'PEGAR_ID_DEL_SHEET_CETA_Gestiones_2026',
   ```
   por el ID que copiaste en el PASO 1. Queda así (ejemplo):
   ```
   GESTIONES_SHEET_ID: '1A2b3C4d5E6f...XyZ',
   ```
5. Guarda con el ícono 💾 (o Ctrl+S). Ponle un nombre al proyecto: `CETA Backend`.

---

## PASO 4 — Publicar como aplicación web

1. Botón **Implementar** (arriba a la derecha) → **Nueva implementación**.
2. En el engranaje ⚙ junto a "Seleccionar tipo", elige **Aplicación web**.
3. Configura:
   - **Descripción:** `CETA v1`
   - **Ejecutar como:** **Yo** (tu correo)
   - **Quién tiene acceso:** **Cualquier usuario**
4. **Implementar**.
5. Google pedirá **autorizar permisos** la primera vez:
   - "Revisar permisos" → elige tu cuenta → "Configuración avanzada" →
     "Ir a CETA Backend (no seguro)" → **Permitir**.
   *(Es normal: es tu propio script accediendo a tus hojas.)*
6. Copia la **URL de la aplicación web** — termina en **`/exec`**.

---

## PASO 5 — Conectar la Consola

1. Abre la Consola CETA → entra como **coordinador**.
2. **Configuración → Conexión Apps Script**.
3. Pega la URL `/exec` en el campo.
4. Pulsa **Probar conexión**.
   - ✅ "Conexión OK" → quedó. El footer cambia a "En línea".
   - ❌ Si falla: revisa que el acceso sea "Cualquier usuario" y que la URL
     termine en `/exec` (no en `/dev`).

---

## Cuando cambies el código del script después

Si editas `Code.gs` más adelante, debes **volver a implementar**:
Implementar → **Gestionar implementaciones** → ✏️ editar → **Versión: Nueva** →
Implementar. (La URL `/exec` se mantiene, no cambia.)

---

## Qué queda activo al conectar

- **Cotizador en vivo:** precios reales desde `Kits Kia` (con respaldo local).
- **Guardar gestiones:** cada gestión se escribe en `CETA_Gestiones_2026`.
- **Actualizar/reasignar:** se sincroniza al Sheet.
- **Control de Gestión:** el coordinador ve las gestiones de todo el equipo.

> Mientras no conectes, la Consola sigue funcionando 100% local sin problema.
