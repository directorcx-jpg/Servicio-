# Guiones Outbound — 4 Tipos Diferenciados

> **Canal:** Voz (llamada saliente)
> **Marcas:** KIA · Honda · FAW
> **Aplica:** Asesores de Call Center CETA
> **Versión:** 2.0 — Mayo 2026 · Owner: Pablo Rincón
> **Tono:** Aplicar siempre el skill `cx-armotor-tone.md`
> **Política We Go:** Sin costo (permanente) — aplica a mantenimientos sin novedad

---

## Estructura general de una llamada saliente

Toda llamada outbound comparte esta columna vertebral de cinco momentos, independientemente del tipo. Lo que cambia es el contenido de cada momento según la situación.

1. **Apertura:** confirmar identidad, presentarse, dar motivo claro en una frase.
2. **Gancho:** la razón por la que vale la pena que el cliente escuche.
3. **Captura/Validación:** datos necesarios y detección de novedades.
4. **Oferta:** mantenimiento + We Go sin costo + Telemetría (si aplica).
5. **Cierre:** agendar o programar seguimiento concreto.

---

# OUTBOUND TIPO 1 · ADVANCE (Primer Mantenimiento)

**Contexto:** El cliente compró un vehículo nuevo con Armotor y se acerca a los 10.000 km o a los 12 meses desde la fecha de matrícula (lo primero que se cumpla). La marca exige ese primer mantenimiento para mantener la garantía vigente. Es la llamada más valiosa porque establece el vínculo con un cliente nuevo.

**VALIDAR**
Antes de llamar, tener a la vista: nombre del cliente, modelo, fecha de matrícula, placa, teléfono. Calcular si está próximo por kilometraje o por tiempo. Si cumple un año sin importar el km, el mantenimiento aplica igual.

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor, mi nombre es **[NOMBRE_ASESOR]**. El motivo de mi llamada es que su **[MODELO]**, matriculado el **[FECHA_MATRICULA]**, está próximo a cumplir su primer servicio de mantenimiento y quiero ayudarle a que todo quede al día con su garantía. ¿Tiene un minuto?"

**DECIR — Gancho (garantía)**
> "Le cuento: la marca recomienda el primer mantenimiento a los 10.000 kilómetros o al cumplir los 12 meses desde la compra, lo primero que ocurra. Realizarlo en nuestro taller autorizado le garantiza que su vehículo conserva la garantía de fábrica completa y que queda registrado en el historial oficial."

**DECIR — Captura rápida**
> "¿Me puede confirmar en cuántos kilómetros tiene su vehículo actualmente?"

Si aún no cumple el km pero se acerca al año:
> "Aunque no haya llegado a los 10.000, como ya se acerca al año, el mantenimiento aplica igualmente por tiempo. Lo bueno es que estamos a tiempo para que todo quede al día."

**DECIR — Oferta con We Go**
> "Y le tengo una excelente noticia: le incluimos **sin ningún costo** nuestro servicio We Go. Nosotros recogemos su vehículo en la dirección que nos indique, le hacemos el mantenimiento completo y se lo devolvemos, sin que usted tenga que desplazarse. ¿Le coordino la recogida?"

**DECIR — Si dice "no tengo el km aún" o "más adelante"**
> "Perfecto, no hay problema. Lo que voy a hacer es enviarle un resumen por WhatsApp con la información del servicio y el valor, para que lo tenga presente. Y cuando se acerque, me llama o me escribe y le agendamos de una vez. ¿Le parece?"

**HACER**
Si acepta: seguir con paso 8 del Inbound (día y hora), luego paso 9 (Telemetría), luego paso 10 (cierre con asesor receptor). Si no acepta: enviar plantilla WhatsApp de primer mantenimiento, registrar "en seguimiento" y programar recontacto.

**ESCALAR**
Si el cliente menciona que ya hizo el mantenimiento en otro taller: no presionar, pero registrar como "visita otro taller" y preguntar amablemente el motivo (precio, ubicación, desconocimiento de que debía ser en red autorizada).

---

# OUTBOUND TIPO 2 · RECUPERACIÓN (Cliente inactivo)

**Contexto:** Cliente que no ha regresado al taller en un período prolongado. Se diferencia en tres perfiles según el tiempo de ausencia, porque el tono y el argumento cambian.

---

## Perfil A — Ausencia 6 a 12 meses (cliente reciente)

**VALIDAR**
Revisar historial: último servicio, modelo, km del último ingreso. Calcular el km estimado actual.

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor, mi nombre es **[NOMBRE_ASESOR]**. Lo llamo porque usted es un cliente importante para nosotros y vemos que su **[MODELO]** podría estar cerca de su próximo mantenimiento. Quería ponerme a su disposición. ¿Tiene un minuto?"

**DECIR — Gancho (continuidad)**
> "En su última visita quedó con **[KM_ANTERIOR]** kilómetros. Si ha rodado normalmente, es probable que ya esté cerca de los **[KM_SIGUIENTE]** que es cuando corresponde el siguiente servicio. Mantener los mantenimientos al día le protege la garantía y el valor de reventa de su vehículo."

**DECIR — Oferta con We Go**
> "Y le cuento que ahora le incluimos **sin costo** nuestro servicio We Go: le recogemos el vehículo en su casa, le hacemos el mantenimiento y se lo devolvemos. Así no tiene que desplazarse. ¿Le agendo?"

---

## Perfil B — Ausencia 12 a 24 meses (cliente tibio)

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor, mi nombre es **[NOMBRE_ASESOR]**. Lo contacto porque ha pasado un tiempo desde la última vez que atendimos su **[MODELO]** y no queremos que pierda los beneficios de la garantía. ¿Me permite un momento?"

**DECIR — Gancho (garantía + diferencial)**
> "Le comento algo importante: la garantía de su vehículo se mantiene activa mientras los mantenimientos se realicen en la red autorizada. Si ha pasado más de un año, es recomendable realizar una revisión para actualizar el registro. Y le recuerdo que en Armotor somos los únicos que ofrecemos la garantía extendida de la marca."

**DECIR — Oferta con We Go**
> "Para facilitarle todo, ahora recogemos su vehículo **sin ningún costo** con nuestro servicio We Go. Lo recogemos, lo atendemos y se lo devolvemos. ¿Qué día le queda bien?"

---

## Perfil C — Ausencia mayor a 24 meses (cliente frío)

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor, mi nombre es **[NOMBRE_ASESOR]**. Lo contacto porque queremos reactivar su relación con nosotros y ofrecerle un beneficio especial para su **[MODELO]**."

**DECIR — Gancho (oferta diferenciada)**
> "Entendemos que han pasado un tiempo. Por eso queremos hacerle una propuesta especial: un servicio de cambio de aceite y revisión multipunto a un valor preferencial, con repuestos originales y la tranquilidad de estar en manos de técnicos certificados por la marca."

Si el vehículo tiene alto kilometraje (>80.000 km):
> "Para vehículos con el rodaje del suyo, es especialmente importante usar repuestos y aceite originales. Le ofrecemos un escaneo completo, revisión de puntos de control y cambio de aceite con lubricante certificado. Es la mejor forma de cuidar su inversión."

**DECIR — Oferta con We Go**
> "Y además, le recogemos el vehículo **sin costo** en su casa. Nosotros nos encargamos de todo."

**HACER (todos los perfiles)**
Si acepta: continuar con pasos 8, 9 y 10 del Inbound (día/hora, Telemetría, cierre). Si no acepta: enviar plantilla WhatsApp de recuperación, registrar motivo de rechazo y programar recontacto si corresponde. Si visitó otro taller: registrar la razón (precio, ubicación, proveedor).

---

# OUTBOUND TIPO 3 · CAMPAÑA DE SEGURIDAD KIA

**Contexto:** Campañas de seguridad obligatorias emitidas por Metrokia. Son intervenciones gratuitas y preventivas. El script base viene de la marca (comunicado CI_C_Kia_008_2026) pero se adapta al tono Armotor. Es obligatorio contactar a todos los clientes de la base y registrar el resultado en el Excel compartido.

**VALIDAR**
Antes de llamar: confirmar que las partes/repuestos están disponibles en bodega. Si no hay stock, **no contactar al cliente** hasta tenerlas. Tener a la vista: VIN (últimos 4 dígitos), modelo, año, nombre, teléfono, ciudad registrada.

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor KIA, mi nombre es **[NOMBRE_ASESOR]**. Lo llamo porque tenemos información importante sobre su vehículo. ¿Tiene un momento?"

**DECIR — Comunicación de la campaña**
> "Le informamos que su vehículo KIA **[MODELO]** **[AÑO]**, identificado con el VIN terminado en **[ÚLTIMOS 4 DÍGITOS VIN]**, presenta una **campaña de seguridad** vigente. Las campañas de seguridad son intervenciones **gratuitas** y preventivas que buscan mantener su vehículo actualizado y garantizar su máxima seguridad. Es un procedimiento que no tiene ningún costo para usted, independientemente del estado de la garantía."

**DECIR — Cierre**
> "¿Le agendamos una cita para que realicemos la intervención? Nosotros nos encargamos de todo."

**DECIR — Si el cliente rechaza**
> "Entiendo. De todos modos, esta información queda registrada y puede consultar las campañas activas en kia.com.co/campanas-de-seguridad. Si en algún momento decide realizar la intervención, estamos a su disposición."

**DECIR — Si está en otra ciudad**
> "¿En qué ciudad se encuentra actualmente? Le registro para que el concesionario más cercano lo pueda contactar."

**HACER**
Registrar en el Excel de la campaña el resultado exacto: No contesta / Teléfonos incorrectos / Cliente rechaza la intervención / Cliente se encuentra en otra ciudad / Cliente acepta la intervención / Vehículo ya intervenido. Si acepta, agendar la cita. Si está en otra ciudad, registrar la "Ciudad Real" para redistribución por KIA Colombia. Enviar el correo electrónico con la plantilla oficial (asunto: "Campaña de Seguridad en Vehículos – Kia [MODELO] – Acción requerida"). Marcar "Correo enviado – Sí/No" en el Excel.

**ESCALAR**
Si no hay repuestos disponibles para la campaña, notificar al jefe regional de servicio por correo y registrar en la columna "Observaciones" del Excel. No contactar al cliente hasta tener las partes.

---

# OUTBOUND TIPO 4 · TOTAL CONFIANZA KIA (Recuperación 600 días)

**Contexto:** Campaña de Metrokia con lubricantes Total. Vigencia: 19 mayo a 31 agosto 2026. Objetivo: recuperar clientes que no han ingresado al taller en más de 600 días. Modelos objetivo: Picanto, K3, Soluto, Rio (lubricante 5W30). Meta: 200 prospectos durante la vigencia. La base de prospectos es suministrada por Metrokia.

**VALIDAR**
Confirmar que el cliente está en la base suministrada por Metrokia. Verificar que sea modelo Picanto, K3, Soluto o Rio. Confirmar stock de aceite Total 5W30 disponible. Tener claro el beneficio a comunicar (definido por la estrategia del concesionario).

**DECIR — Apertura**
> "Muy buenos días/tardes, ¿hablo con **[NOMBRE_CLIENTE]**? Le saludo de Armotor KIA, mi nombre es **[NOMBRE_ASESOR]**. Lo contacto porque queremos reconectarnos con usted y hacerle una propuesta especial para su **[MODELO]**."

**DECIR — Gancho (beneficio especial)**
> "Vemos que hace un tiempo no nos visita y no queremos que se pierda los beneficios de mantener su vehículo con nosotros. Le tenemos una oferta especial: un servicio de mantenimiento con **condiciones preferenciales**, repuestos originales y técnicos certificados por la marca. Es nuestra forma de darle la bienvenida de vuelta."

**DECIR — We Go como cierre**
> "Y lo mejor: le recogemos el vehículo **sin ningún costo** con nuestro servicio We Go. Lo recogemos en su casa, le hacemos todo el servicio y se lo devolvemos listo. ¿Qué día le queda bien?"

**DECIR — Si dice que visitó otro taller**
> "Lo entendemos. Sin embargo, le comparto algo importante: cuando el mantenimiento se realiza en nuestra red autorizada, su vehículo conserva la garantía vigente, se utilizan repuestos 100% originales y cada servicio queda registrado en el historial oficial del vehículo, lo que incrementa su valor de reventa. La oferta que le estoy compartiendo hoy es válida hasta agosto y tiene condiciones que difícilmente encontrará en otro lugar. ¿Le gustaría conocer más?"

**DECIR — Si dice "no me interesa"**
> "Entiendo perfectamente, respeto su decisión. Solo quiero que sepa que en Armotor siempre estamos disponibles cuando lo necesite. Mantener el mantenimiento al día no solo cuida su vehículo sino que también protege su valor de reventa y su garantía. Si en algún momento cambia de opinión, aquí estoy para ayudarle. ¡Que tenga un excelente día!"

**HACER**
Si acepta: seguir con pasos 8, 9 y 10 del Inbound. Asegurar que en la OT quede registrado como cliente de la campaña Total Confianza (necesario para el recobro a Metrokia). Tomar foto con banner de Total Energies visible durante la atención. Si no acepta: enviar plantilla WhatsApp de recuperación con el beneficio. Registrar resultado.

**ESCALAR**
Si el cliente pregunta por el precio exacto del servicio, consultar el valor con las condiciones preferenciales definidas para la campaña. Si solicita descuentos adicionales más allá de lo establecido, escalar al Líder de Posventa.

---

## Guión de Recuperación Honda y FAW

**Contexto:** Aplica la misma estructura del Outbound Tipo 2 (Recuperación). La diferencia es el gancho, que debe adaptarse a los beneficios específicos de cada marca.

### Honda
> "Le cuento que Honda ofrece una garantía robusta para su **[MODELO]** y mantener los mantenimientos al día en la red autorizada es clave para que esa garantía se mantenga activa. Además, cada servicio queda registrado en el historial oficial de Honda, lo que protege el valor de su vehículo."

**[BENEFICIO PENDIENTE]** — Pablo: definir si hay oferta diferenciada para recuperación Honda (descuento, combo especial, etc.). Una vez definido, se integra al guion.

### FAW
> "En Armotor somos el taller autorizado FAW en el Eje Cafetero. Nuestros técnicos conocen su **[MODELO]** y usamos repuestos 100% originales. Queremos asegurarnos de que su vehículo reciba la mejor atención."

**[BENEFICIO PENDIENTE]** — Pablo: definir si hay oferta diferenciada para recuperación FAW.

---

## Resumen de los 4 tipos de Outbound

| Tipo | Objetivo | Gancho principal | We Go gratis | Telemetría |
|------|----------|-----------------|:---:|:---:|
| Advance | 1er mantenimiento (10K/12 meses) | Garantía de fábrica | ✅ | ✅ KIA |
| Recuperación A (6-12m) | Reactivar cliente reciente | Continuidad + garantía | ✅ | ✅ KIA |
| Recuperación B (12-24m) | Reactivar cliente tibio | Garantía extendida | ✅ | ✅ KIA |
| Recuperación C (+24m) | Reactivar cliente frío | Oferta preferencial | ✅ | ✅ KIA |
| Seguridad KIA | Intervención obligatoria | Gratuito + seguridad | N/A (no es mtto) | No |
| Total Confianza | Recuperar +600 días | Condiciones preferenciales | ✅ | ✅ KIA |
| Recuperación Honda | Reactivar cliente Honda | Garantía Honda | ✅ | No |
| Recuperación FAW | Reactivar cliente FAW | Red autorizada | ✅ | No |

---

*Contenido construido a partir del skill CX Armotor, transcripciones Fireflies (Voz 021), comunicados Metrokia (CI_C_Kia_008_2026, Total Confianza), y lineamientos del Director CX. Última actualización: Mayo 2026.*
