# 05 · Plan de implementación

## Estado al 28/09/2026

| Etapa | Estado |
|---|---|
| 1 · Auditoría | ✔ Hecha: repositorio vacío, sin sistema previo (ver `01-auditoria.md`) |
| 2 · Núcleo operativo | ✔ Hecha, con tests (detalle abajo) |
| 3 · Prospección | **En curso.** Bloque A hecho (cola, costos, lectura respetuosa, auditoría técnica). Falta lo que depende de decisiones tuyas |
| 4 · Demos y comunicación | Pendiente |
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
| 6 | Investigación con IA (hechos solo de páginas leídas, cada uno con URL) | Pendiente | Necesita proveedor y presupuesto de IA (pregunta 2) |
| 7 | Puntaje de oportunidad con explicación por criterio | Pendiente | Hoy hay puntaje **técnico** del sitio. El de oportunidad necesita la investigación (tarea 6) para no inventar criterios |
| 8 | Descubrimiento de empresas | Pendiente | Necesita elegir fuente (pregunta 3) |
| 9 | Deduplicación por nombre + ciudad | Pendiente | Por dominio ya existe |
| 10 | Panel: pestaña Auditoría, página Tareas, contador de tareas con problemas | ✔ | `src/app/panel/…` |

**Verificación del bloque A:** 131 tests automáticos (51 nuevos) contra PostgreSQL real, typecheck,
build de producción, `npm audit` sin vulnerabilidades, y recorrido en navegador real: alta de
prospecto → "Generar auditoría" sobre `example.com` → resultado guardado, sin errores de consola y sin
desborde horizontal en celular.

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
2. **Proveedor de IA para los agentes.** ¿Con qué cuenta y API key? La clave va como variable de
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
