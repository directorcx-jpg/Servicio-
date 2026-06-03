# MÓDULO 3 — COTIZADOR DE MANTENIMIENTOS KIA
## Brief completo para Claude Code — Consola CETA Armotor

> **Alcance:** Solo KIA. Honda y FAW deshabilitados.
> **Repositorio:** directorcx-jpg/Servicio- · **Hosting:** GitHub Pages
> **Colores:** Rojo #E53935, gris oscuro #2C2C3E, blanco
> **Idioma código:** comentarios en español

---

## 1. RESUMEN EJECUTIVO

El cotizador permite a los asesores del call center consultar el precio de un
mantenimiento KIA, ver el detalle de lo que incluye, y enviarle al cliente una
tarjeta digital por WhatsApp con toda la información. Funciona con datos
reales que se leen en vivo desde Google Sheets (precios) y un archivo estático
(detalle de servicios extraído de los manuales oficiales de KIA).

---

## 2. FUENTES DE DATOS

### 2.1 Precios — pestaña `Kits Kia` (en vivo desde Drive)
- **Libro:** ID `1B0vYkjXKJ1BDv0O9SbVKbzkPZidpUrqlY2XKs7mCl3c`
- **Pestaña:** `Kits Kia` (568 filas, 17 columnas)
- **Lectura:** por NOMBRE de encabezado (robusto a reordenamiento de columnas)
- **Columnas clave:** `Modelo`, `Código.kit`, `Descripción`, `MO+Impto`, `Rec+Impto`, `Tot+Impto`
- **Limpieza al vuelo:** filtrar Tot>0, descartar "No Coincide" y "Cambio Aceite N"
- **Caché:** CacheService 6 min
- **Cobertura:** 41 modelos KIA, 535 servicios con precio

### 2.2 Detalle de servicios — archivo `FEED_DETALLE.json` (estático)
- Extraído de los manuales oficiales de garantía KIA (gasolina, diésel, híbrido)
- Organizado por **combustión → kilometraje** (NO por modelo)
- Cada km tiene: `incluido` (lista de servicios) y `noIncluido` (sujetos a inspección)
- La misma lista aplica a TODOS los modelos de esa combustión
- Este archivo se embebe en el frontend (no necesita endpoint, rara vez cambia)

### 2.3 Combos de embellecimiento — pestaña `Ayudas` del mismo libro
- Columnas J-K (Descripción, Valor), filas 2-8
- 7 opciones: Ninguno ($0), Lavado Sencillo ($33.000), Combo Motor ($109.900),
  Combo Usados ($209.900), Combo 1 ($249.900), Combo 2 ($499.900), Combo 3 ($599.900)
- Se pueden hardcodear o leer del sheet

### 2.4 Clasificación de combustión
Inferida del nombre del modelo. Se usa para: (a) filtrar modelos en el dropdown,
(b) buscar el detalle de servicios en FEED_DETALLE.

```javascript
const COMBUSTION = {
  "Gasolina": ["CARENS (RP 2,0)","CARNIVAL (KA4)","CARNIVAL (YP)","CERATO (YD 1,6)",
    "CERATO VIVRO (BDm 1,6)","EKO 1.25","K31.6","K4 (2.0OMPI)","PICANTO (JA 1,0)",
    "PICANTO (JA 1,25)","PICANTO (TA 1,0)","PICANTO (TA 1,25)","RIO (SC 1,4)",
    "RIO (UB 1,25)","RIO (UB 1,4)","SELTOS (SP2.0)","SELTOS (SP2i1.5)",
    "SEPHIA (SEPHIA 1,4)","SOLUTO (AB 1,4)","SONET (QY)","SORENTO (MQ4 3,5)",
    "SORENTO (UM 3,3)","SORENTO (UMA 3,3)","SOUL (PS 1,6)",
    "SPORTAGE GASOLINA (QLGAS2.0)","SPORTAGE GASOLINA (SLGAS2.0)",
    "SPORTAGE NQ5 (NQ5GAS2.0)","STONIC (YB 1,0)","TONIC (SC 1,6)"],
  "Diésel": ["SORENTO (MQ4DI2,2TCI)","SPORTAGE DIESEL (QLDH1.6)",
    "SPORTAGE DIESEL (QLDI2.0)","TASMAN (TKDI2.2)"],
  "Híbrida": ["NIRO (DE HEV 1,6) Antigua","NIRO (SG2HEV1.6)","OPTIMA (JFHEV)",
    "SPORTAGE HIBRIDA (NQ5HEV1.6)"],
  "Eléctrica": ["EV3 (SV1)","EV5 (OV)","EV6(CV)","EV9(MV)"]
};
```

---

## 3. APPS SCRIPT — endpoint `consultarCotizador`

Lee la pestaña `Kits Kia` en vivo, limpia y cachea. Devuelve JSON.

```javascript
const COTIZADOR_SHEET_ID = '1B0vYkjXKJ1BDv0O9SbVKbzkPZidpUrqlY2XKs7mCl3c';
const KITS_KIA_TAB = 'Kits Kia';

function consultarCotizador() {
  const cache = CacheService.getScriptCache();
  const cacheado = cache.get('cotizador_kia');
  if (cacheado) return JSON.parse(cacheado);

  const hoja = SpreadsheetApp.openById(COTIZADOR_SHEET_ID).getSheetByName(KITS_KIA_TAB);
  const datos = hoja.getDataRange().getValues();
  const enc = datos.shift().map(h => String(h).trim());

  // Ubicar columnas por NOMBRE (no por posición)
  const col = (n) => enc.findIndex(h => h.toLowerCase() === n.toLowerCase());
  const cMod = col('Modelo'), cKit = col('Código.kit'), cDesc = col('Descripción'),
        cMO = col('MO+Impto'), cRec = col('Rec+Impto'), cTot = col('Tot+Impto');

  const esBasura = (m) => /no coincide|cambio aceite|^revisi[oó]n (par|impar)/i.test(m);
  const normServ = (d) => String(d).replace(/rv\.?/ig, 'RV.').replace(/\bkm\b/ig, 'KM')
                                    .replace(/\s+/g, ' ').trim();
  const filas = [];
  const vistos = new Set();
  datos.forEach(f => {
    const modelo = String(f[cMod] || '').trim();
    const total = Number(f[cTot]) || 0;
    if (!modelo || esBasura(modelo) || total <= 0) return;
    const servicio = normServ(f[cDesc]);
    const llave = modelo + '|' + servicio;
    if (vistos.has(llave)) return;
    vistos.add(llave);
    filas.push({
      marca: 'KIA', modelo, servicio,
      manoDeObra: Number(f[cMO]) || 0,
      repuestos: Number(f[cRec]) || 0,
      total,
      kit: String(f[cKit] || '').trim()
    });
  });

  // Cachear 6 min
  cache.put('cotizador_kia', JSON.stringify(filas), 360);
  return filas;
}

// Enrutar en doGet:
// if (e.parameter.accion === 'cotizador') return jsonResponse(consultarCotizador());
```

---

## 4. SISTEMA DE RESPALDO (3 capas — el asesor nunca espera)

```javascript
// Patrón de carga en el frontend
async function obtenerPrecios() {
  const KEY = 'cotizador_kia_cache';

  // Capa 1: mostrar instantáneamente lo último que funcionó (localStorage)
  const local = localStorage.getItem(KEY);
  if (local) renderCotizador(JSON.parse(local));

  try {
    // Capa 2: datos en vivo con timeout de 3 s
    const vivo = await Promise.race([
      fetch(API_URL + '?accion=cotizador').then(r => r.json()),
      new Promise((_, rej) => setTimeout(() => rej('timeout'), 3000))
    ]);
    localStorage.setItem(KEY, JSON.stringify(vivo)); // refresca backup
    renderCotizador(vivo);
  } catch (e) {
    // Capa 3: semilla de data.js (solo si nunca ha cargado)
    if (!local) renderCotizador(COTIZADOR_KIA_SEED);
  }
}
```

El detalle de servicios (FEED_DETALLE) y los combos NO usan este patrón porque
son estáticos — van embebidos en el código.

---

## 5. FLUJO DEL ASESOR (cascada de dropdowns dependientes)

### Campos del formulario (en orden de dependencia):
1. **MARCA** — KIA fijo (Honda/FAW en gris, deshabilitados, tooltip "Próximamente")
2. **COMBUSTIÓN** — Gasolina / Diésel / Híbrida / Eléctrica → filtra modelos
3. **MODELO** — Solo modelos de esa combustión → filtra km
4. **KM SERVICIO** — Solo los km disponibles para ese modelo
5. **DESCUENTO** — Manual: 0%, 10%, 20%, 30%, 40%, 50% → se aplica sobre mano de obra
6. **EMBELLECIMIENTO** — Ninguno, Lavado Sencillo, Combo Motor, Combo 1/2/3, Combo Usados

### Cálculo del VALOR ESTIMADO:
```
VALOR = round(ManoDeObra × (1 - descuento%)) + Repuestos + Embellecimiento
```

### Detalle de la tarjeta (qué incluye el mantenimiento):
Se busca en FEED_DETALLE por combustión + kilometraje (el más cercano al km seleccionado).
Se separa en: ✅ Incluido (N servicios) y ⚠️ No incluido (filtro aire A/C, filtro aire motor,
caucho plumillas — siempre estos 3, sujetos a inspección del técnico).

---

## 6. TARJETA DIGITAL (salida para el cliente)

La tarjeta tiene dos formatos: texto para WhatsApp (con botón Copiar) e imagen
descargable (tarjeta visual con marca Armotor).

### Formato texto WhatsApp:
```
Mantenimiento [MODELO] - [KM] km
✅ Incluye en el precio ([N] servicios):
• [lista de servicios incluidos]
⚠️ NO incluido - sujeto a inspección del técnico:
• Cambio Filtro de Aire del A/C
• Cambio Filtro de Aire del Motor
• Cambio caucho plumillas (validar estado)
💰 Valor aproximado: $[TOTAL]
🛁 Lavado básico (enjuague exterior + aspirado interior).
   Combos de embellecimiento disponibles aparte.
📋 Llevar: tarjeta de propiedad, manual de garantías,
   llave de pernos (si tiene), SOAT y tecnomecánica vigentes.
¿Le agendamos su cita? 📅
```

### Formato imagen (tarjeta visual):
- Logo Armotor arriba
- Modelo + KM grande
- Precio destacado en rojo corporativo
- Resumen: "Incluye N servicios" con los principales
- "No incluye" en color diferente
- Sede, fecha, asesor al pie
- Generada con HTML→Canvas→PNG (botón "Descargar tarjeta")

---

## 7. REGLA KIA-ONLY (Honda / FAW)

- Honda y FAW: el botón/opción de cotizador NO aparece o aparece deshabilitado
- Mensaje: "Cotizador no disponible para esta marca. Consulta con el asesor de taller."
- Blindaje backend: el endpoint solo devuelve filas marca KIA

---

## 8. REGLAS PARA NO ROMPER LA FUENTE DE DATOS

Para el equipo (no es código, es disciplina):
1. No borrar fila 1 (encabezados) de `Kits Kia`
2. No renombrar: `Modelo`, `Descripción`, `MO+Impto`, `Rec+Impto`, `Tot+Impto`, `Código.kit`
3. Agregar modelos, cambiar precios, sumar km: libre, fluye automático

---

## 9. ARCHIVOS QUE ACOMPAÑAN ESTE BRIEF

| Archivo | Qué contiene | Dónde va |
|---------|-------------|----------|
| `FEED_DETALLE.json` | Detalle de servicios por combustión y km (incluido/noIncluido) | Embebido en el frontend como constante JS |
| `cotizador_seed.js` | Semilla de precios + combustión + combos (respaldo capa 3) | Importado en data.js como fallback |

---

## 10. PENDIENTES MENORES (fuera de esta fase)

- [ ] Agregar eléctricos (EV3/EV5/EV6/EV9) y Stonic al FEED_DETALLE (solo 5 modelos, pocos km)
- [ ] Precios Honda y FAW (cuando estén estructurados, habilitar esas marcas)
- [ ] Tarjeta visual descargable (imagen PNG) — puede ser fase siguiente
