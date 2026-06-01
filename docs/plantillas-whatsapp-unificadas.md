# Plantillas WhatsApp — Catálogo Unificado CETA

> **Canal:** WhatsApp
> **Aplica:** Todos los asesores CETA
> **Versión:** 2.0 — Mayo 2026 · Owner: Pablo Rincón
> **Tono:** Aplicar `cx-armotor-tone.md`
> **Formato:** Asteriscos para negritas WhatsApp nativas (`*texto*`)
> **Variables:** Se reemplazan al copiar. En el portal se autocompletan desde el panel derecho.

---

## Auditoría realizada

| Fuente | Antes | Después | Eliminadas |
|--------|:-----:|:-------:|:----------:|
| Chatwoot | 28 | — | — |
| Portal actual | 25 | — | — |
| **Total original** | **53** | **25** | **28** |

Razones de eliminación: 4 saludos personalizados por asesor → 1 con variable. 4 plantillas de campaña 20% por asesor → 1 genérica en sección campañas. 8 duplicadas entre Chatwoot y portal → versión unificada. 12 fragmentos incompletos (solo frases sueltas como "Le confirmo, tenemos disponibilidad para") → absorbidos en plantillas completas.

---

# CATEGORÍA 1 · SALUDOS Y APERTURA (3 plantillas)

---

### 1.1 — Saludo inicial asesor
**Usar cuando:** El cliente escribe por primera vez o se le asigna un chat.

```
¡Hola! 👋 Mucho gusto, mi nombre es *[NOMBRE_ASESOR]*, asesor de Armotor.

Gracias por comunicarse con nosotros. ¿En qué le puedo ayudar?
```

---

### 1.2 — Bienvenida bot (automática)
**Usar cuando:** Mensaje automático de primer contacto en el canal.

```
¡Hola! 👋 Bienvenido a *Armotor*.

🛡️ Al enviarnos tus datos, aceptas nuestra Política de Tratamiento de Datos Personales. Armotor S.A.S. garantiza tus derechos de habeas data.
Más info: https://armotor.com/politicas-de-tratamiento-de-datos-personales/

¿Con qué te puedo ayudar hoy?
```

---

### 1.3 — Saludo campaña activa
**Usar cuando:** Se contacta al cliente como parte de una campaña (descuento, recuperación, etc.). Reemplazar `[CAMPAÑA]` y `[BENEFICIO]` según la campaña vigente.

```
¡Hola! 👋 Soy *[NOMBRE_ASESOR]* de Armotor KIA. Le escribo porque este mes tenemos *[CAMPAÑA]* y no quería que se le pasara esta oportunidad.

[BENEFICIO]

¿Le agendo su cita? Solo necesito que me confirme el día que le funciona mejor. 😊
```

---

# CATEGORÍA 2 · CAPTURA DE DATOS (3 plantillas)

---

### 2.1 — Solicitar datos para agendar
**Usar cuando:** El cliente quiere agendar y necesitas la información básica.

```
Para agendar tu cita de mantenimiento, por favor indícame:

📌 Nombre completo
📌 Placa del vehículo
📌 Kilometraje aproximado actual
📌 Ciudad donde se encuentra el vehículo
📌 Motivo o tipo de mantenimiento

Con estos datos te agendo de inmediato. 😊
```

---

### 2.2 — Validar novedades y adicionales
**Usar cuando:** Ya tienes los datos básicos y necesitas saber si hay síntomas antes de ofrecer We Go.

```
Antes de confirmarle los horarios disponibles, ¿su vehículo presenta algún adicional que reportar? Como sonidos, desajustes o vibraciones.

También, *¿me confirma el aproximado de kilómetros de su vehículo?* 🚗
```

---

### 2.3 — Explicar mantenimiento por km o tiempo
**Usar cuando:** El cliente no sabe si le toca mantenimiento o cree que aún no cumple el kilometraje.

```
Le cuento algo importante: el mantenimiento de su KIA se programa *por kilometraje o por tiempo*, lo primero que se cumpla.

Dependiendo de la referencia, puede ser cada 10.000 km. Entonces, aunque su vehículo cumpla el año en *[MES]*, es posible que por kilometraje ya esté cerca o ya haya pasado el momento.

*¿Me puede regalar el kilometraje que marca su tablero en este momento?* 🚗 Así le confirmo si ya es hora y le ayudo a programar su cita.
```

---

# CATEGORÍA 3 · DISPONIBILIDAD Y AGENDAMIENTO (3 plantillas)

---

### 3.1 — Ofrecer disponibilidad
**Usar cuando:** Vas a proponer fechas y horarios disponibles.

```
Ya le confirmo la disponibilidad más cercana en *[CIUDAD]* 📍

Para *[FECHA]* tengo disponibilidad:
• *[HORA_1]*
• *[HORA_2]*
• *[HORA_3]*

¿Cuál le confirmo? ✅
```

---

### 3.2 — Preguntar preferencia de día
**Usar cuando:** El cliente no ha indicado preferencia de fecha.

```
Claro que sí 😊

¿Para qué día le queda cómodo ingresar? Yo le verifico la disponibilidad y le agendo con mucho gusto. 📅
```

---

### 3.3 — Cita reagendada
**Usar cuando:** Se cambia una cita ya confirmada.

```
Le confirmo que su cita quedó *reagendada* para:

📅 *[NUEVA_FECHA]* a las *[NUEVA_HORA]*
📍 *[CIUDAD]*
👤 Con *[NOMBRE_ASESOR_SERVICIO]*

¡Lo esperamos! 🚗
```

---

# CATEGORÍA 4 · COTIZACIÓN Y PRECIO (2 plantillas)

---

### 4.1 — Cotización de mantenimiento (generada por el Cotizador)
**Usar cuando:** Se envía el detalle del mantenimiento. Esta plantilla se genera automáticamente desde el módulo Cotizador del portal; aquí va la estructura de referencia.

```
*Mantenimiento [MODELO] – [KM] km* 🔧

✅ *Incluye ([N] servicios):*
• Cambio aceite y filtro motor
• Diagnóstico eléctrico especializado
• Inspección de frenos, suspensión, dirección
• Alineación, balanceo y rotación de llantas
• Revisión de [N] puntos de control
• Prueba de ruta
• Lavado exterior y aspirado interior
[... lista completa del Cotizador]

⚠️ *NO incluido* (sujeto a inspección del técnico):
• Cambio filtro aire motor
• Cambio filtro aire A/C
• Cambio cauchos plumillas

💰 *Valor aproximado:* $[PRECIO]
⚠️ Precios sujetos a variación: precios mes de *[MES_ACTUAL]*

📋 *Llevar:* tarjeta de propiedad, manual de garantías, llave de pernos (si tiene)

¿Le confirmo su cita? 📅
```

---

### 4.2 — No cumple kilometraje aún
**Usar cuando:** El cliente tiene pocos kilómetros y no le corresponde mantenimiento todavía.

```
¡Perfecto! Con *[KM_ACTUAL]* km aún tienes margen tranquilo. Tu primer mantenimiento sería al llegar a los *[KM_SIGUIENTE]* km o al cumplir el año, lo primero que pase.

Te recomiendo que estés pendiente del kilometraje y cuando te acerques nos escribas por aquí o nos llames para agendarte. Nosotros también te vamos a estar recordando. 😊

Y si antes de eso tienes alguna duda o necesitas algo para tu vehículo, aquí estamos para ayudarte. 🚗
```

---

# CATEGORÍA 5 · CONFIRMACIÓN DE CITA (2 plantillas)

---

### 5.1 — Confirmación completa (formato oficial)
**Usar cuando:** Se confirma una cita con todos los detalles. Es la plantilla estándar del CETA.

```
✅ *LE CONFIRMO SU CITA*

📅 *Fecha:* [DÍA_SEMANA] [FECHA_COMPLETA]
🕐 *Hora:* [HORA]
📍 *Ciudad:* [CIUDAD]
👤 *Asesor de Servicio:* [NOMBRE_ASESOR_SERVICIO]

🔧 *Servicio:* [TIPO_SERVICIO]
💰 *Valor aproximado:* $[PRECIO]

📍 *Dirección:* [DIRECCIÓN_COMPLETA]

⚠️ *RECOMENDACIONES:*
• Llegar con puntualidad a la hora asignada
• Disponer de 15 a 30 minutos para recepcionar el vehículo
• No incluye cambio de filtro de A/C ni plumillas (sujetos a verificación)
• El lavado es básico (enjuague + aspirado); combos de embellecimiento disponibles

📄 *Llevar:*
• Tarjeta de propiedad
• Manual de garantías
• Llave de pernos (si tiene)

*¿Le puedo colaborar en algo más?* 😊
```

---

### 5.2 — Confirmación corta
**Usar cuando:** Confirmación rápida cuando el cliente ya tiene el contexto.

```
Cita confirmada ✅

📅 *[FECHA]* a las *[HORA]* en *[CIUDAD]*
👤 Con *[NOMBRE_ASESOR_SERVICIO]*

Recuerde llegar puntual y traer tarjeta de propiedad y manual de garantías. ¡Lo esperamos! 🚗
```

---

# CATEGORÍA 6 · OBJECIONES Y SEGUIMIENTO (5 plantillas)

---

### 6.1 — Cliente dice "lo voy a pensar"
**Usar cuando:** El cliente no se decide pero no rechaza.

```
¡Claro que sí! Tómese su tiempo con toda tranquilidad. 😊

Para que no se le pase, ¿qué le parece si le reservo un espacio tentativo y si decide no tomarlo, lo cancelamos sin ningún compromiso? Así se asegura de tener disponibilidad en el día y horario que más le convenga. ¿Qué dice? 📅
```

---

### 6.2 — Cliente dice "no me interesa"
**Usar cuando:** Rechazo directo. Mantener la puerta abierta.

```
Entiendo perfectamente, respeto su decisión. 🙏

Solo quiero que sepa que en Armotor siempre estamos disponibles cuando lo necesite. Mantener el mantenimiento al día no solo cuida su vehículo sino que también protege su valor de reventa y su garantía.

Si en algún momento cambia de opinión o necesita cualquier asesoría con su vehículo, aquí estoy para ayudarle. ¡Que tenga un excelente día! 😊
```

---

### 6.3 — Cliente dice "lo llevo a otro taller"
**Usar cuando:** El cliente tiene otro taller de confianza.

```
Entiendo, y es válido que tenga su taller de confianza. 👍

Sin embargo, le comparto un dato importante: cuando el mantenimiento se realiza en nuestra red autorizada, su vehículo *conserva la garantía de fábrica vigente*, se utilizan repuestos 100% originales y nuestros técnicos están certificados directamente por la marca. Además, cada servicio queda registrado en el historial oficial del vehículo, lo que incrementa su valor de reventa.

Si alguna vez quiere una segunda opinión o comparar, lo invitamos con todo gusto. 😊
```

---

### 6.4 — Cliente dice "no tengo el kilometraje" (mantenimiento por tiempo)
**Usar cuando:** El vehículo no llega al km pero ya cumple o se acerca al tiempo.

```
¡Perfecto, gracias por compartirme eso! 😊

*¿Me puede indicar aproximadamente en cuántos kilómetros tiene su vehículo actualmente?*

Recuerde que el mantenimiento no solo se mide por kilometraje sino también por tiempo. Si ha pasado más de 12 meses desde su último servicio, es recomendable realizar una revisión sin importar el kilometraje.

Si aún no le toca, se la podemos guardar para cuando sea su momento. ¿Le parece?
```

---

### 6.5 — Seguimiento (segundo contacto)
**Usar cuando:** Se recontacta a un cliente con quien ya se habló.

```
¡Hola [NOMBRE_CLIENTE]! 👋

Te escribo nuevamente de Armotor. Hace unos días hablamos sobre el mantenimiento de tu *[MODELO]*.

¿Pudiste revisar la información? ¿Tienes alguna duda que pueda resolver?

Recuerda que te *recogemos el vehículo sin costo* con nuestro servicio We Go. Solo dime el día y me encargo de todo. 🚗
```

---

# CATEGORÍA 7 · CIERRE Y GESTIÓN DE CHAT (3 plantillas)

---

### 7.1 — Cierre estándar
**Usar cuando:** La gestión terminó exitosamente.

```
*¿Le puedo colaborar en algo más?* 😊

Para servirle, gracias por preferirnos. ¡Que tenga un excelente día! 🚗
```

---

### 7.2 — Cliente no responde (30+ min)
**Usar cuando:** El cliente lleva más de 30 minutos sin responder en un chat activo.

```
👋 ¿Sigues allí?

Cuando estés disponible, podemos retomar la conversación. ¡Estoy aquí para ayudarte! 😊
```

---

### 7.3 — Cierre por inactividad (+1 hora, con llamada fallida)
**Usar cuando:** El cliente no respondió, se intentó llamar y no se logró contacto.

```
Hola *[NOMBRE_CLIENTE]* 👋

No hemos podido establecer contacto contigo. Intentamos llamarte pero no pudimos comunicarnos.

Estaremos atentos cuando desees retomar la conversación. Puedes escribirnos o comunicarte a nuestras líneas:

📞 Manizales: 3116097675
📞 Armenia: 3148144259
📞 Pereira: 3206320999

¡Que tenga un excelente día! 🚗
```

---

# CATEGORÍA 8 · COMERCIAL / LEADS (4 plantillas)

---

### 8.1 — Primer contacto lead
**Usar cuando:** Se contacta por primera vez a un lead que dejó sus datos en redes sociales.

```
¡Hola *[NOMBRE]*! 👋

Soy *[NOMBRE_ASESOR]* de Armotor. Gracias por tu interés en *[MARCA/MODELO]*.

Tenemos excelentes opciones disponibles para ti. ¿Te gustaría que te cuente más sobre las promociones actuales y opciones de financiación? 💰

Estoy aquí para ayudarte a encontrar tu carro ideal. 😊
```

---

### 8.2 — Invitar a vitrina / prueba de manejo
**Usar cuando:** El lead ya mostró interés y se quiere llevar a la sede.

```
Me encantaría que conocieras el *[MODELO]* en persona. Es muy diferente verlo en fotos que sentarte en él. 🚗

📍 Te invito a nuestra sede en *[CIUDAD]*:
*[DIRECCIÓN]*

¿Qué día te queda cómodo para visitarnos? Puedo reservarte un espacio para que hagas *prueba de manejo*. 🔑

*¡Sin compromiso, solo ven a conocerlo!*
```

---

### 8.3 — Información de financiación
**Usar cuando:** El lead pregunta por formas de pago o financiación.

```
Te cuento las opciones de financiación para el *[MODELO]*:

💳 Financiación hasta *84 meses*
📉 Tasas competitivas
✅ Respuesta rápida de los bancos
🎁 Promociones especiales este mes

Para darte una cotización personalizada, ¿me confirmas:
• Cuota inicial aproximada
• Plazo preferido (36, 48, 60, 72 meses)

¡Te armo varias opciones! 📊
```

---

### 8.4 — Vehículos usados certificados
**Usar cuando:** El lead está interesado en usados.

```
¡Hola *[NOMBRE]*! 👋

Gracias por tu interés en nuestros *vehículos usados certificados*. 🚙

En Armotor todos nuestros usados pasan por:
✅ Revisión técnica completa
✅ Historial verificado
✅ Garantía incluida
✅ Financiación disponible

Cuéntame, ¿qué tipo de vehículo estás buscando? ¿Tienes algún modelo en mente o me cuentas tu presupuesto y te ayudo a encontrar opciones? 💰
```

---

## Plantillas eliminadas y por qué

| Plantilla eliminada | Razón |
|---|---|
| Hola Alejo / Hola Johanna / Hola Juan Diego / Hola Juan Manuel | Reemplazadas por 1.3 (saludo campaña con variable) |
| Buenas / Buenos (Juan Manuel) | Reemplazadas por 1.1 (saludo genérico con variable) |
| Le / Le confir (fragmentos) | Absorbidos en 3.1 y 3.3 |
| horarios | Absorbido en 2.2 |
| Para | Absorbido en 7.1 |
| recomendacion | Absorbido en 5.1 |
| saludo karen / Saludo. | Reemplazadas por 1.1 |
| NO RESPONDE (Chatwoot) | Fusionado con 7.2 |
| Ocupado (Chatwoot) | Fusionado con 7.2 |
| Confirmar Detalles (portal) | Absorbido en 2.2 |
| Validar Pico y Placa (portal) | Movido a Base de Conocimiento (dato operativo, no plantilla) |
| Kit de Seguridad (portal) | Movido a campañas (contenido promocional, no plantilla operativa) |
| Fuera de Horario (portal) | Se mantiene solo si hay bot; si no, se elimina |
| Solicitar Llamar (portal) | Absorbido en flujo natural del asesor |
| Confirmar Visita comercial (portal) | Fusionado con 5.1 (misma estructura) |
| Seguimiento 2do contacto comercial (portal) | Fusionado con 6.5 |
| Transferir a Asesor (portal) | Se mantiene como operativa interna, no como plantilla de catálogo |

---

*53 plantillas → 25 plantillas limpias, sin redundancias, con tono Armotor y formato WhatsApp nativo. Última actualización: Mayo 2026.*
