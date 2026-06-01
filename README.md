# Consola CETA Armotor

Consola operativa (SPA) para el call center CETA de Armotor. Integra guiones de
atención, cotizador de mantenimientos y un **panel de cierre unificado** que
reemplaza los formularios de Google, con generación automática de la nota Quiter,
la tipificación de Evolution y el resumen para el cliente.

Desplegada como sitio estático en **GitHub Pages** (sin compilación).

## Arquitectura (3 archivos)

| Archivo | Rol |
|---|---|
| `index.html` | Estructura + CSS (design tokens propios) + pantalla de login. Carga `app.js` como `<script type="module">`. |
| `app.js` | Lógica: autenticación, roles, navegación, estado reactivo `S`, panel de cierre, cotizador, salidas. `import { DATA } from './data.js'`. |
| `data.js` | Todo el contenido: usuarios, permisos, cotizador local, tipificador, sedes, campañas. `export const DATA`. |

> Requiere servirse desde un servidor (GitHub Pages o `npx serve .` en local).
> No funciona abriendo el archivo con doble clic (los ES Modules exigen `http://`).

## Cómo correr en local

```bash
npx serve .
# o
python -m http.server 8000
```

Abrir `http://localhost:3000` (o el puerto indicado).

## Login y roles

Pantalla de login con selector de usuario + **PIN de 4 dígitos**. La sesión se
guarda en `localStorage`.

- **PINs temporales** sembrados en `data.js` para arranque inmediato.
- El coordinador los cambia en **Configuración → Usuarios** (se guardan en `localStorage`).
- Rol del coordinador (Pablo): PIN inicial `2468`. Cámbialo en el primer ingreso.

Roles: `coordinador`, `analista` (solo lectura del panel), `asesor_cc`, `asesor_digital`.
Cada rol filtra vistas y permisos según `DATA.permisos`.

## Estado actual — Fase 1 + Fase 2 ✅

- Login con PIN + 4 roles con permisos.
- Layout de 3 columnas, Home por rol, sidebar, tema claro/oscuro, omnibox.
- **Panel de cierre unificado**: 6 secciones condicionales, cotizador integrado,
  3 salidas en tabs (Quiter / Evolution / Cliente), semáforo de completitud,
  adicionales split (cliente vs taller), tarjeta descargable (html2canvas).
- Cotizador y guardado operan **100% local** (sin backend todavía).

## Pendiente

- **Fase 3** — Cargar contenido real desde `docs/`: 10 pasos Inbound, 4 guiones
  Outbound, 25 plantillas WhatsApp, calificador P1–P4, base de conocimiento.
- **Fase 4** — Apps Script (`guardarGestion`, `consultarCotizador`, `buscarPlaca`)
  y vista de Control de Gestión + Modo TV. Configurar `DATA.config.endpoints`.
- **Fase 5** — Módulo Internos CETA.
- Completar `DATA.cotizador.local` con todos los modelos × km × precio.
- Que el coordinador defina los **PINs definitivos**.

## Referencias del proyecto

- `docs/brief-tecnico-claude-code.md` — especificación técnica.
- `docs/cx-armotor-tone.md` — tono y voz (aplicar en toda redacción al cliente).
- `docs/spec-panel-cierre-unificado.md` — detalle del panel y las 40 columnas del Sheet.
- `mockups/mockup-portal-ceta-v4.html` — referencia visual final.
