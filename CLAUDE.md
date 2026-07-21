# CRM CETA — Armotor

## Qué es
CRM web del call center CETA de ARMOTOR (grupo automotriz multimarca del Eje
Cafetero: KIA, Honda, FAW, Usados Certificados; sedes Armenia, Pereira,
Manizales, Cartago, La Dorada). Consolida TODA la gestión de los asesores
CETA en posventa y comercial en una sola plataforma.

**Visión:** vista 360 del cliente e integración con la base de datos, el ERP
Quiter, Evolution (telefonía) y Chatwoot (chat) — hoy son roadmap, sin
accesos aún. Ver [docs/roadmap.md](docs/roadmap.md).

## Arquitectura actual (no romper)
- **Frontend:** SPA vanilla JS sin bundler (`index.html` + `app.js` +
  `data.js`, ES Modules por CDN). Español (Colombia). Colores: rojo #E53935,
  gris #2C2C3E, blanco.
- **Backend:** Supabase (proyecto Armotor-Ceta) — datos, RLS y Auth
  (Google Workspace SSO, solo @armotor.com con lista blanca).
- **Deploy:** GitHub Pages vía GitHub Actions (`.github/workflows/deploy.yml`
  inyecta las credenciales Supabase desde Secrets en los meta tags; el
  `index.html` del repo SIEMPRE va con esos meta vacíos).
- **Apps Script:** vive SOLO para el cotizador KIA (`consultarCotizador`) y
  `ping`. Todo lo demás es Supabase.
- Detalle completo (tablas, enums, policies, decisiones):
  [docs/arquitectura.md](docs/arquitectura.md).

## Módulos
1. Panel de cierre unificado (gestiones posventa) · 2. Casos internos con
rotación automática · 3. Cotizador de mantenimientos KIA · 4. Protocolos de
atención (base de conocimiento) · 5. Control de gestión y Home operativo ·
6. Leads comerciales.

## Usuarios y roles
Roles: `administrador`, `coordinador`, `analista`, `asesor_cc`,
`asesor_digital` (permisos en `DATA.permisos`; `asesor_digital` no participa
en asignación de casos internos; la rotación automática es solo `asesor_cc`).
**La lista real de personas vive en Supabase (`usuarios_autorizados` +
`usuarios`) — única fuente de verdad. No mantener nombres aquí ni en el
código.**

## Reglas de negocio
- Propiedad de leads/clientes: 20 días por asesor. Casos internos: propiedad
  por placa 10 días, rotación diaria en bloques de 5 (colas A/B).
- Meta de primer contacto: menos de 2 horas.
- Todo contacto documentado con fecha, hora y observación.
- Leads KIA requieren marca de subida a SGC.

## Reglas de trabajo OBLIGATORIAS
1. **Ciclo de skills para todo desarrollo nuevo** (sin excepciones salvo
   bugs puntuales de un archivo):
   `brainstorming` → `design-ceta-spec` (spec en `docs/specs/`) →
   implementar → `verify-after-change` (10 casos en navegador).
2. **Sin commit ni push sin revisión explícita de Pablo.** Siempre mostrar
   resumen de cambios antes.
3. **Migraciones de Supabase solo vía MCP** (`apply_migration` con nombre en
   snake_case). Nunca SQL de esquema sin registro.
4. **Verificar en navegador antes de cerrar** cualquier cambio de UI/lógica:
   `preview_start` con el server `ceta`, consola sin errores. En local los
   meta de Supabase están vacíos (la app corre sin datos); los flujos
   autenticados se prueban con sesión de Pablo o contra el sitio publicado.

## Referencias
- Especificaciones funcionales: `docs/specs/`
- Roadmap y visión 360: `docs/roadmap.md`
- Arquitectura técnica y decisiones: `docs/arquitectura.md`
- App publicada: https://directorcx-jpg.github.io/Servicio-/
