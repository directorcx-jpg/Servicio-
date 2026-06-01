# Guion Comercial + Calificador Integrado

> **Canal:** Voz (llamada saliente a leads de redes sociales)
> **Aplica:** 2 Asesores Digitales CETA
> **Propósito:** Contactar leads de Facebook/Instagram, calificar en la conversación y decidir si se asigna en SGC (KIA) o Quiter (Honda/FAW/Usados)
> **Versión:** 2.0 — Mayo 2026 · Owner: Pablo Rincón
> **Tono:** Aplicar `cx-armotor-tone.md`

---

## Principio de diseño

El calificador NO es un formulario aparte. Es la conversación misma.

Cada fase del guion corresponde a una pregunta del calificador. El asesor habla con el cliente y, mientras lo hace, toca una pill en el panel que registra la respuesta. Al terminar la llamada, el puntaje ya está calculado sin pasos adicionales.

De ~25 clicks en la versión anterior → **6-7 clicks máximo**.

---

## Clasificación de resultados

| Clasificación | Rango | Acción | Sistema |
|---|---|---|---|
| 🔴 P1 — Alta prioridad | 70-100 pts | Asignar con prioridad | SGC (KIA) o Quiter (Honda/FAW/Usados) |
| 🟡 P2 — Media prioridad | 40-69 pts | Asignar en plataforma | SGC o Quiter |
| 🔵 P3 — Baja prioridad | 10-39 pts | Asignar como compra futura | SGC o Quiter |
| ⚫ P4 — No aplica | 0-9 pts | NO asignar. Enviar info por WhatsApp | — |

---

## FASE 1 · APERTURA Y VALIDACIÓN
**Tiempo:** 30 segundos
**Califica:** A. Intención real (máx 25 pts)

### Qué decir

> "Buenos días/tardes, ¿hablo con **[NOMBRE]**?"
>
> *(Esperar confirmación)*
>
> "Mucho gusto **[NOMBRE]**, mi nombre es **[ASESOR]**, lo llamo de Armotor **[MARCA]** en **[CIUDAD]**. Vimos que nos dejó sus datos en Facebook mostrando interés en **[VEHÍCULO/PROMOCIÓN]**. ¿Tiene un minutico para que conversemos?"

### Si dice NO (no tiene tiempo)
> "¿Le puedo llamar más tarde hoy o prefiere mañana? ¿A qué hora le queda más cómodo?"

Registrar para recontacto. No insistir.

### Si no recuerda haber dejado datos
> "A veces los formularios de Facebook se envían accidentalmente. ¿Estaría interesado en conocer sobre **[VEHÍCULO]**? Le cuento en un minuto."

### Calificador — tocar una pill:

| Pill | Puntos | Color |
|------|:------:|-------|
| **Recuerda y confirma interés** | +15 | Verde |
| **Tiene modelo definido** | +10 | Azul (acumulable con la anterior = 25 pts) |
| **No recuerda / niega interés** | 0 | Gris → candidato a P4 |

---

## FASE 2 · NECESIDAD Y URGENCIA
**Tiempo:** 90 segundos
**Califica:** E. Urgencia de compra (máx 15 pts)

### Qué decir

> "Cuénteme **[NOMBRE]**, ¿qué tipo de vehículo está buscando? ¿Tiene algún modelo o marca en mente?"

Registrar: nuevo o usado, marca, modelo.

> "¿Este vehículo sería para uso personal, familiar o para trabajo?"

Registrar uso (no da puntos, pero es dato útil para el asesor comercial).

> "¿Para cuándo está pensando hacer el cambio? ¿Es algo que busca para este mes o está mirando más a futuro?"

### Calificador — tocar una pill:

| Pill | Puntos | Color |
|------|:------:|-------|
| **Menos de 30 días** | +15 | Verde 🔥 |
| **1 a 3 meses** | +10 | Azul |
| **3 a 6 meses** | +5 | Naranja |
| **Solo mirando / sin plazo** | 0 | Gris |

### Pregunta adicional (retoma)

> "¿Actualmente tiene un vehículo? ¿Ha pensado en darlo como parte de pago?"

Si tiene retoma → pill adicional acumulable: **+5 pts** (se suma a Capacidad Financiera).

---

## FASE 3 · UBICACIÓN GEOGRÁFICA
**Tiempo:** 20 segundos
**Califica:** B. Ubicación (máx 15 pts)

### Qué decir

> "¿Desde qué ciudad nos escribe? Nosotros tenemos sedes en Armenia, Pereira, Manizales, Cartago y La Dorada. ¿Cuál le queda más cómoda?"

### Si está fuera del Eje Cafetero
> "Entiendo. ¿Estaría dispuesto a venir hasta alguna de nuestras sedes para el proceso de compra? Tenemos clientes que vienen de otras ciudades porque les ofrecemos muy buenas condiciones."

**Error común a evitar:** en las llamadas reales detectamos que a veces el asesor no profundiza cuando el cliente dice una ciudad lejana (ej: Cali). Si el cliente está fuera de zona, hay que confirmar explícitamente si está dispuesto a desplazarse, porque eso cambia la calificación de 0 a 5 puntos.

### Calificador — tocar una pill:

| Pill | Puntos | Color |
|------|:------:|-------|
| **Eje Cafetero (Armenia, Pereira, Manizales, Cartago, La Dorada)** | +15 | Verde |
| **Municipios aledaños (< 1 hora)** | +10 | Azul |
| **Otra zona, pero dispuesto a venir** | +5 | Naranja |
| **No dispuesto a venir** | 0 | Gris |

---

## FASE 4 · CAPACIDAD FINANCIERA
**Tiempo:** 90 segundos
**Califica:** C. Capacidad financiera (máx 30 pts)

### Qué decir

> "¿Ha tenido la oportunidad de mirar los precios de los modelos que le interesan? ¿Tiene un presupuesto en mente?"

> "¿Está pensando en comprarlo de contado o le gustaría conocer opciones de financiación?"

### Si dice FINANCIACIÓN

> "Perfecto, nosotros trabajamos con los principales bancos. Para que el asesor le pueda dar opciones, ¿me puede indicar aproximadamente cuánto estaría dispuesto a dar de cuota inicial?"

> "¿Actualmente es empleado, independiente o pensionado?"

> "¿Tiene alguna idea de cómo está su historial crediticio? ¿Ha consultado Datacrédito recientemente?"

### Si es reticente a dar datos financieros
> "Lo entiendo perfectamente. Esta información es solo para que el asesor pueda ofrecerle las mejores opciones de financiación. Todo es confidencial. ¿Al menos me puede decir si es empleado o independiente?"

**Error común a evitar:** NO leer los requisitos del banco antes de calificar. Primero se califica, después se informa.

### Calificador — tocar las pills:

**Ingresos (obligatorio elegir una):**

| Pill | Puntos | Color |
|------|:------:|-------|
| **Ingresos > 2 SMLV (demostrables)** | +20 | Verde |
| **Ingresos 1.5 a 2 SMLV** | +10 | Azul |
| **No declara / < 1.5 SMLV** | 0 | Gris |

**Adicionales (opcionales, acumulables):**

| Pill | Puntos | Color |
|------|:------:|-------|
| **+ Cuota inicial ≥ 10%** | +5 | Azul |
| **+ Vehículo para retoma** | +5 | Azul |

---

## FASE 4B · PERFIL CREDITICIO
**Califica:** D. Perfil crediticio (máx 15 pts)

Esta subfase ocurre dentro de la misma conversación financiera, no es una fase separada.

### Calificador — tocar una pill:

| Pill | Puntos | Color |
|------|:------:|-------|
| **Sin reporte en centrales / buen historial** | +15 | Verde |
| **Reportado pero deuda saldada (Ley Borrón)** | +8 | Azul |
| **Reportado con deuda vigente, dispuesto a explorar** | +3 | Naranja |
| **Reportado sin solución clara** | 0 | Gris |

---

## FASE 5 · CIERRE Y DECISIÓN
**Tiempo:** 60 segundos

En este punto el puntaje ya está calculado automáticamente en el panel. El asesor mira el resultado y actúa.

### Si el puntaje es ≥ 10 (P1, P2 o P3) — ASIGNAR

> "Excelente **[NOMBRE]**, con lo que me comenta usted califica para que uno de nuestros asesores comerciales lo contacte y le presente las mejores opciones. ¿Le parece bien si le paso sus datos para que lo llame?"

**Acción:** Asignar en SGC (si es KIA) o Quiter (si es Honda, FAW o Usados). Copiar el resumen del calificador y pegarlo como observación en la plataforma.

### Si el puntaje es < 10 (P4) — NO ASIGNAR

> "Gracias **[NOMBRE]** por su tiempo. En este momento le voy a enviar información por WhatsApp para que la revise con calma. Cualquier duda me puede escribir. ¡Que tenga buen día!"

**Acción:** NO asignar en plataforma. Enviar plantilla WhatsApp con información del vehículo de interés. Registrar como P4 en el sistema.

---

## Manejo de objeciones frecuentes

### "Solo estaba mirando"
> "Totalmente entendible. Justamente para eso tenemos asesores que pueden darle toda la información sin compromiso. Solo necesito hacerle unas preguntas rápidas para conectarlo con el asesor indicado. ¿Me permite?"

### "Estoy reportado en centrales de riesgo"
> "Gracias por comentármelo. Nosotros trabajamos con diferentes entidades financieras que tienen opciones para diferentes perfiles. ¿La deuda ya está saldada o sigue vigente?"

### "No tengo cuota inicial"
> "Entiendo. Algunos de nuestros aliados manejan financiación hasta del 100%. ¿Me puede contar un poco sobre su situación laboral para ver qué opciones le podríamos ofrecer?"

### "Dígame el precio por teléfono"
> "Con gusto le doy un rango: el **[MODELO]** arranca desde **[PRECIO_BASE]**. El precio exacto depende de versión y accesorios. Para darle una cotización precisa, ¿me permite hacerle unas preguntas rápidas?"

### "Ya estoy hablando con otro concesionario"
> "Excelente que esté cotizando. Nosotros tenemos condiciones muy competitivas. ¿Me permite hacerle unas preguntas para ver si le podemos ofrecer algo mejor?"

### "Llámeme después / Estoy ocupado"
> "Por supuesto. ¿A qué hora le queda más cómodo? ¿Prefiere hoy más tarde o mañana?"

Registrar hora exacta para callback. No asumir "más tarde".

### "Estoy muy lejos / No soy del Eje Cafetero"
> "Entiendo. ¿Estaría dispuesto a venir hasta alguna de nuestras sedes para el proceso de compra? Tenemos clientes que vienen de otras ciudades porque les ofrecemos muy buenas condiciones."

---

## Resumen del calificador integrado

| Fase | Pregunta | Máx pts | Clicks |
|------|----------|:-------:|:------:|
| 1. Apertura | A. Intención real | 25 | 1-2 |
| 2. Necesidad | E. Urgencia de compra | 15 | 1 |
| 3. Ubicación | B. Ubicación geográfica | 15 | 1 |
| 4. Financiero | C. Capacidad financiera | 30 | 1-3 |
| 4B. Crédito | D. Perfil crediticio | 15 | 1 |
| **Total** | | **100** | **5-8 clicks** |

Duración total de la llamada: ~5 minutos.
El puntaje se calcula en vivo en el panel derecho (sticky).
El resultado + resumen se copia con un botón para pegar en SGC/Quiter.

---

## Sistemas de transferencia (referencia rápida)

| Marca | Sistema | Acción |
|-------|---------|--------|
| KIA | SGC | Asignar lead con resumen |
| Honda | Quiter | Asignar lead con resumen |
| FAW | Quiter | Asignar lead con resumen |
| Usados | Quiter | Asignar lead con resumen |

---

## Errores comunes detectados en auditoría de llamadas

Estos errores se identificaron en las transcripciones reales del equipo. El guion está diseñado para prevenirlos:

| Error | Qué pasaba | Cómo lo previene el guion |
|-------|-----------|--------------------------|
| Leer requisitos bancarios antes de calificar | El asesor espantaba al cliente con documentación antes de saber si calificaba | La fase financiera pregunta primero; los requisitos se dan solo si el cliente califica |
| No validar ubicación geográfica | Cliente estaba en Cali, se asignó igual y se perdió el lead | Fase 3 pregunta explícitamente la ciudad y si está dispuesto a desplazarse |
| No capturar presupuesto | Se derivaba al asesor comercial sin dato de presupuesto | Fase 4 pregunta presupuesto directamente |
| Cierre frío sin siguiente paso | "Bueno, quedo atento, chao" | Fase 5 tiene cierre diferenciado según P1-P4 |
| Derivar sin información suficiente | El asesor comercial recibía un lead sin contexto | El resumen copiable incluye todos los datos capturados |

---

*Contenido construido a partir del skill CX Armotor, análisis de llamadas reales (Fireflies 100138548, 100138503), y lineamientos del Director CX. Última actualización: Mayo 2026.*
