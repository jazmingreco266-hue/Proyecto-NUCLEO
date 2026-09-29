# 05 · Plan de implementación

## Estado al 28/09/2026

| Etapa | Estado |
|---|---|
| 1 · Auditoría | ✔ Hecha: repositorio vacío, sin sistema previo (ver `01-auditoria.md`) |
| 2 · Núcleo operativo | ✔ Hecha, con tests (detalle abajo) |
| 3 · Prospección | **En curso.** Hechos: cola, costos, lectura respetuosa, auditoría técnica, investigación con IA y puntaje de oportunidad. Faltan capturas, descubrimiento y deduplicación por nombre + ciudad |
| 4 · Comunicación | ✔ Mensajes por canal y descarga del email HTML. **Las demos se retiraron** por decisión tomada el 29/09/2026 |
| 5 · Ejecución de proyectos | Pendiente |
| 6 · Seguridad, migración y SEO | Pendiente |
| 7 · Ventas adicionales | Pendiente |

## Etapa 2: qué quedó hecho

- [x] Esquema de datos con restricciones de veracidad y registros inmutables
- [x] Migrador con checksum
- [x] Usuarios, roles y sesiones seguras
- [x] Pipeline de 25 estados con reglas por actor y control de versión
- [x] Aprobaciones humanas, con doble aprobación para borrar datos de producción
- [x] Hechos con fuente, URL, fecha, confianza y estado
- [x] Notas, pausa y descarte
- [x] Configuración con límites y su historial
- [x] Registro de actividad
- [x] Panel: vista general, tabla de oportunidades con filtros, ficha con 13 pestañas,
      aprobaciones, configuración, usuarios y actividad
- [x] Adaptado a celular, modo oscuro y claro

## Etapa 3: estado por tarea

| # | Tarea | Estado | Dónde |
|---|---|---|---|
| 1 | Worker y cola (`SKIP LOCKED`, reintentos con espera creciente, recuperación de trabajos colgados, deduplicación) | ✔ | `src/server/services/agent-runs.ts`, `scripts/worker.ts`, `/api/cron/agentes` |
| 2 | Control de costos, horario y autonomía | ✔ | `src/domain/agent-guards.ts`, `src/agents/orchestrator.ts` |
| 3 | Lectura respetuosa de sitios (robots.txt, SSRF, límites) | ✔ | `src/agents/http.ts`, `src/domain/robots.ts` |
| 4 | Auditoría técnica objetiva sin IA, versionada | ✔ | `src/domain/site-audit.ts`, `src/agents/website-audit.ts` |
| 5 | Capturas escritorio/celular | Pendiente | Necesita un navegador en el servidor: depende de dónde corra el worker (pregunta 1) |
| 6 | Investigación con IA (hechos solo de páginas leídas, cada uno con URL) | ✔ Claude Opus 5.5 | `src/domain/research.ts`, `src/agents/business-research.ts`. Falta probarla con una clave real (ver abajo) |
| 7 | Puntaje de oportunidad con explicación por criterio | ✔ | `src/domain/opportunity.ts`. Se recalcula solo al terminar una auditoría o investigación y al cargar o retirar un dato |
| 8 | Descubrimiento de empresas | Pendiente | Necesita elegir fuente (pregunta 3) |
| 9 | Deduplicación por nombre + ciudad | Pendiente | Por dominio ya existe |
| 10 | Panel: pestaña Auditoría, página Tareas, contador de tareas con problemas | ✔ | `src/app/panel/…` |

**Verificación del bloque A:** 131 tests automáticos (51 nuevos) contra PostgreSQL real, typecheck,
build de producción, `npm audit` sin vulnerabilidades, y recorrido en navegador real: alta de
prospecto → "Generar auditoría" sobre `example.com` → resultado guardado, sin errores de consola y sin
desborde horizontal en celular.

### Investigación con IA: cómo funciona

- Lee la página principal y hasta 4 internas útiles (nosotros, servicios, contacto…) con el mismo lector
  respetuoso de la auditoría. Si el sitio no tiene texto legible, no llama a la IA (costo 0).
- Claude devuelve datos con salida estructurada. El servidor la valida y aplica la regla de veracidad:
  un **hecho observado** necesita la URL de una página leída y una cita que aparezca textual en ella.
  Si no, se descarta y queda listado como "descartado por no poder verificarse".
- Los observados se guardan como **probables** (confianza máxima 80) y las inferencias e hipótesis como
  **no verificadas** (máxima 60). Nada de la IA figura como verificado: eso lo hace una persona.
- Si la IA recomienda calificar, el prospecto pasa a **Calificado** (y el orquestador puede auditarlo).
  Descartar lo decide siempre una persona.
- Costo: se calcula con el uso que informa la API y la tabla oficial de precios
  (`PRICING_USD_PER_MTOK` en `src/domain/research.ts`). También se registra el costo de las respuestas
  rechazadas o inválidas. Tope estimado por investigación: US$ 0,24.
- Si un clasificador de seguridad de Claude declina el pedido, la API lo reintenta en el modelo
  recomendado por Anthropic (`fallbacks: "default"`). Si igual se declina, la tarea queda bloqueada.

**No verificado todavía:** una llamada real a la API. Este entorno de trabajo no tiene clave, así que
el agente se probó con una IA simulada (12 tests) y la forma del pedido se comprobó contra los tipos del
SDK oficial (`@anthropic-ai/sdk` 0.129.0). La primera investigación real conviene hacerla sobre un
prospecto conocido y revisar el resultado.

## Etapa 4: qué quedó hecho

- **Sin demos.** Por decisión tomada el 29/09/2026 no se generan demos ni páginas de propuesta. El
  código quedó en el historial de Git (commit `d4a9f57`) por si se quiere recuperar. Los estados «Generando demo» y
  «Demo lista» siguen en la base por compatibilidad, marcados en desuso: se puede salir de ellos pero no entrar.
- **Mensajes** (`src/domain/outreach.ts`): lo positivo del negocio sale solo de un hecho observado; si no hay, el
  sistema avisa en vez de inventar un elogio. Las tres mejoras salen de la auditoría y se redactan como beneficios.
  Cierran ofreciendo una propuesta sin compromiso y una charla. El horario sugerido se aclara como sugerencia
  general, no como dato medido. Incluyen una línea para darse de baja.
- **Estados:** preparar mensajes lleva Auditado → Mensaje listo. "Enviado manualmente" lo marca siempre una persona.

## Finanzas, cotizador, portafolio y copias de seguridad (29/09/2026)

- **Ventas y gastos** (`src/domain/finance.ts`, `src/server/services/finance.ts`): la base impide editarlos o
  borrarlos (trigger `money_guard`). Para corregir un error se anula con motivo y se carga de nuevo; el anulado
  sigue visible y no suma. Montos en centavos para no acumular redondeos. Cada moneda por separado, sin convertir.
- **Resultado mensual** por fecha de la operación (lo vendido y gastado en el mes, cobrado o no).
- **Balance simplificado**: Activo = caja (cobrado − pagado) + cuentas por cobrar; Pasivo = cuentas por pagar;
  Patrimonio = Activo − Pasivo. Solo con lo cargado; no reemplaza el balance de un contador.
- **Cotizador**: lista de precios en Configuración (valores iniciales = rangos de mercado de Argentina 2026 ya
  citados, para reemplazar). Impuesto por defecto 0 %: depende de la situación fiscal.
- **Excel** (`src/server/xlsx.ts`): generador propio sin dependencias. Se descartó `exceljs` 4.4.0 porque `npm audit`
  marcaba 2 vulnerabilidades moderadas (dependencia `uuid`). El archivo se validó con openpyxl y con LibreOffice
  Calc, que lo abre y recalcula las fórmulas con los mismos resultados.
- **Copia de seguridad**: el JSON incluye todas las tablas nuevas. Configuración muestra la fecha de la última copia
  y avisa si pasaron más de 7 días. Las copias automáticas en la nube dependen del proveedor de la base de datos
  (revisar su plan); el panel no guarda copias fuera de la base por su cuenta.

### Puntaje de oportunidad

Promedio ponderado de los criterios **que tienen datos**: necesidad de modernización (peso 3, sale del
puntaje técnico), mejoras visibles para el cliente (2), facilidad de contacto (2), negocio activo según la
investigación (2) y calidad de la información (1). Capacidad de pago, competencia y probabilidad de
respuesta figuran como "sin datos": no se estiman para no inventar. Con menos de 3 criterios medidos no
hay puntaje. El desglose se ve en la ficha, pestaña Empresa → "Cómo se calcula".

### Qué hace hoy la auditoría (y qué no)

- **Mide:** HTTPS, HSTS, contenido mixto, encabezados de seguridad, viewport, zoom, anchos fijos,
  tiempo de descarga, peso, compresión, scripts que bloquean, imágenes, título, descripción, H1,
  canónica, noindex, Open Graph, datos estructurados, sitemap, idioma, texto alternativo, etiquetas de
  formularios, enlaces vacíos, medios de contacto, WhatsApp, llamados a la acción, año del pie,
  jQuery antiguo, Flash, etiquetas obsoletas, analítica, redes, mapa y hasta 8 enlaces internos.
- **No puntúa:** diseño, claridad comercial, calidad del contenido ni potencial de automatización.
  Aparecen como "No evaluado" hasta que exista el agente de investigación con IA.
- **Recomendación:** preliminar (contactar / observar / descartar) según el puntaje técnico, el
  umbral de descarte configurado y si hay contacto público. No estima esfuerzo ni valor comercial.
- Un prospecto **Calificado** pasa solo a **Auditado** al terminar. En otro estado, o pausado, la
  auditoría se guarda sin mover nada.

## Preguntas agrupadas para el propietario

Estas decisiones afectan dinero, terceros o credenciales, así que no las tomo solo
(sección 17 del documento maestro).

1. **Hosting.** ¿Dónde se va a desplegar el panel y el worker? Necesita Node 22 y PostgreSQL 16.
   Contratar hosting es una acción que requiere tu aprobación.
2. ~~**Proveedor de IA para los agentes.**~~ Resuelto: Claude (Anthropic). Falta cargar la clave y el presupuesto.
   Texto original: ¿Con qué cuenta y API key? La clave va como variable de
   entorno del servidor, nunca en el código. ¿Presupuesto mensual inicial?
3. **Fuentes de descubrimiento.** Opciones típicas: Google Places API (paga por consulta y exige
   atribución), directorios empresariales con API o carga manual asistida.
   ¿Cuál preferís probar primero y con qué presupuesto?
4. **Mercados iniciales.** ¿Arrancamos solo por Argentina? ¿Qué ciudades y rubros?
5. **Segundo factor (2FA)** para entrar al panel antes de publicarlo en internet: ¿lo querés
   en la etapa 3?

## Bloqueos registrados

| Qué | Por qué | Alternativas | Requiere aprobación |
|---|---|---|---|
| Operación 24/7 | Hace falta un servidor desplegado | Hosting administrado (paga) o un VPS propio | Sí: contratar hosting |
| Agentes con IA | Hace falta una API key con presupuesto | Ya funciona la auditoría técnica sin IA | Sí: gasto |
| Capturas de sitios | Hace falta un navegador headless en el servidor; en Vercel no viene incluido | Worker en un VPS con Chromium, o un servicio de capturas pago | Sí: hosting o servicio pago |
| Descubrimiento automático | Hace falta elegir una fuente legítima | Carga manual (ya funciona) | Sí si la fuente es paga |
