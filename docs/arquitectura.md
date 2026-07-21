# Arquitectura técnica — CRM CETA

> Fotografía técnica del sistema en producción. Si algo de aquí contradice
> el código o la base, manda el código/base y hay que actualizar este doc.

## Stack
- **Frontend:** SPA vanilla JS sin bundler. `index.html` (UI + estilos),
  `app.js` (lógica, ES Module), `data.js` (config, textos, seeds),
  `cotizador-seed.js` (respaldo de precios KIA).
- **Módulos Supabase:** `src/lib/supabaseClient.js` (cliente, credenciales
  por meta tags), `src/lib/auth.js` (SSO Google, sesión, perfil),
  `src/lib/usuarios.js` (personas: asesores CC, operadores, asesores de
  taller), `src/lib/gestiones.js` (todo el acceso a datos de gestiones +
  traducción UI⇄BD).
- **Hosting:** GitHub Pages. Deploy con `.github/workflows/deploy.yml`
  (push a `main` → inyecta `SUPABASE_URL`/`SUPABASE_ANON_KEY` desde GitHub
  Secrets en los meta tags → publica). El repo NUNCA lleva credenciales.
- **Apps Script (legado vivo):** solo `consultarCotizador` (lee el libro
  "Kits Kia") y `ping`. URL en `data.js` → `config.endpoints.base`.

## Autenticación
- Google Workspace SSO vía Supabase Auth, restringido a @armotor.com.
- Lista blanca: `usuarios_autorizados` (email, alias, rol, activo). Un
  trigger crea la fila en `usuarios` (uuid = auth.uid) en el PRIMER login.
  Consecuencia: una persona no aparece en listas de asignación hasta que
  entra por primera vez.
- `S.user = {id, email, nombre, alias, rol, sede_asignada}` tras login.
- Permisos de UI: `DATA.permisos[rol]` + helpers `can()` / `esCoordinacion()`.

## Base de datos (Supabase, proyecto Armotor-Ceta)
Tablas núcleo y relaciones:
- `clientes` (upsert por `telefono` normalizado a dígitos)
- `vehiculos` (upsert por `placa` en mayúsculas; FK `cliente_id`; incluye
  `marca`, `modelo`, `combustion`, `km_actual`)
- `gestiones` — el corazón: FKs `cliente_id`, `vehiculo_id`, `asesor_cc_id`
  (dueño), `cotizacion_id`, `cita_asesor_taller_id`; enums `sede`
  (`ciudad_sede`: valores con la capitalización de la UI, ej. `Pereira`,
  `La Dorada`), `origen` (`origen_gestion`: minúsculas, incl. `interno`),
  `resultado` (`resultado_gestion`), `estado` (`estado_gestion`:
  `pendiente`/`gestionada`); casos internos = `origen='interno'` +
  `estado='pendiente'` + `cola`/`asignado_a`/`asignado_motivo`/
  `radicado_por`; seguimientos en `fecha_seguimiento` (timestamptz) +
  `seguimiento_observacion`; trazabilidad en `historial` (jsonb),
  tipificación en `evolution_json` (jsonb), `nota_quiter` (text).
- `cotizaciones` (`km_servicio`, `valor_total`, `detalle_json`; doble
  relación con gestiones — el embed usa el hint `fk_gestiones_cotizacion`)
- `asesores_taller` (FK `sede_id` → `sedes`; alimenta el select de cita;
  match por nombre → FK, sin match → `cita_asesor_taller_nombre` libre)
- `sedes` (uuid + `ciudad` enum), `usuarios`, `usuarios_autorizados`.

RLS (resumen): lectura para autenticados en las tablas operativas; escritura
de gestiones para todo el equipo activo (`gestiones_insert_equipo` — permite
radicar asignando a otros); administración de personas/sedes solo
administrador/coordinador (`mi_rol()`); anónimos no ven nada operativo.

## Patrones del frontend
- **Online-first:** Supabase es la fuente de verdad. `localStorage` es solo
  caché de lectura (`ceta_gestiones`, stale-while-revalidate con throttle
  15 s) + borrador de seguridad (`ceta_borrador_gestion`) si falla un
  guardado (el formulario NO se limpia).
- **Cachés de personas en `S`:** `asesoresCC` (rotación), `operadores`
  (asignación manual: cc+coordinador+analista+admin), `asesoresTaller`
  (select de cita, con fallback al seed de `data.js` si está vacía).
  Se cargan al login y se revalidan al refrescar internos.
- **Rotación de casos internos:** colas A/B, bloques de 5 barajados, reset
  diario, propiedad por placa 10 días (`ceta_colas` en localStorage).
- **Traducción UI⇄BD:** vive SOLO en `src/lib/gestiones.js`
  (`uiDesdeFila`, mapas de enums). La UI habla su formato histórico
  (camelCase, pills `agenda`/`seg`/...).

## Decisiones vigentes (no revertir sin discusión)
1. `usuarios_autorizados` + `usuarios` = única fuente de personas. Ninguna
   lista de usuarios en localStorage ni en archivos del repo.
2. Corte duro online-first: no hay doble escritura ni sync bidireccional.
3. Rotación automática solo `asesor_cc`; asignación manual también
   coordinador/analista/administrador; `asesor_digital` excluido de internos.
4. `administrador` ≥ `coordinador` en permisos (helper `esCoordinacion()`).
5. Los meta tags de Supabase en `index.html` van vacíos en el repo; solo el
   workflow los llena.
6. Migraciones de esquema/policies únicamente vía MCP (`apply_migration`).

## Entorno de desarrollo
- Server local: `.claude/launch.json` → nombre `ceta`
  (`python -m http.server 8123`). En local Supabase queda deshabilitado
  (meta vacíos): la UI carga, los datos no. Flujos autenticados se prueban
  con sesión de Pablo o contra el sitio publicado.
- Skills del proyecto en `.claude/skills/` (versionados):
  `brainstorming`, `design-ceta-spec`, `verify-after-change`.
- Specs funcionales en `docs/specs/` (`YYYY-MM-DD-titulo.md`).
