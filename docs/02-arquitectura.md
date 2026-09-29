# 02 · Arquitectura objetivo y mapa de agentes

## Stack elegido

| Capa | Tecnología | Por qué |
|---|---|---|
| Panel + servidor | Next.js 16 (App Router) + React 19 + TypeScript | Un solo despliegue para panel y lógica de servidor. Server Actions con chequeo CSRF de origen incorporado. |
| Base de datos | PostgreSQL 16 | Transacciones, `jsonb`, triggers para logs inmutables, y sirve también como cola de trabajos. |
| Acceso a datos | Drizzle ORM + `pg` | SQL explícito y tipado, sin binarios externos. |
| Migraciones | Archivos `.sql` numerados + migrador propio con checksum SHA-256 | Cada cambio de esquema es revisable y el migrador se niega a correr si alguien editó una migración ya aplicada. |
| Validación | Zod | Toda entrada de usuario o de agente se valida en el servidor. |
| Contraseñas | bcrypt (costo 12) | Estándar probado. |
| Tests | Vitest contra una base Postgres real | Los tests de integración usan la misma base que producción, no mocks. |
| Colas | Tabla `agent_runs` + worker Node con `SELECT … FOR UPDATE SKIP LOCKED` | No suma otra infraestructura (Redis) mientras el volumen sea chico. |
| Lectura de HTML | node-html-parser | Parser liviano y probado; evita analizar HTML con expresiones regulares. |

## Capas del código

```
src/
  domain/     Reglas puras, sin base de datos: pipeline, permisos, aprobaciones, validaciones.
  db/         Esquema Drizzle, conexión, migrador.
  server/     Servicios (acceso a datos + auditoría en la misma transacción), autenticación.
  app/        Panel: páginas, Server Actions y componentes.
  agents/     Orquestador, lector respetuoso de sitios y agentes especializados.
migrations/   SQL versionado.
tests/        Unitarios (domain) e integración (server, contra Postgres).
```

Regla de dependencias: `domain` no importa nada del resto. `server` importa `domain` y `db`.
`app` solo habla con `server`. Los agentes también pasan por `server`, así heredan
los mismos permisos, validaciones y logs que un usuario humano.

## Flujo general

```
Scheduler ─▶ Orchestrator ─▶ cola (agent_runs) ─▶ agentes especializados
                                                     │
                                                     ▼
                              servicios del servidor (permisos + validación + auditoría)
                                                     │
                                                     ▼
                                                PostgreSQL
                                                     │
                                                     ▼
                                   Panel ◀── propietario revisa y aprueba
                                                     │
                                  acciones sensibles ─▶ tabla approvals ─▶ ejecución
```

Ningún agente ejecuta una acción sensible directamente. Solo puede **crear una solicitud de
aprobación**. La acción se ejecuta cuando el propietario la aprueba en el panel.

## Mapa de agentes y workers

| Agente | Etapa | Entrada | Salida | Puede cambiar estado a | Nunca puede |
|---|---|---|---|---|---|
| Orchestrator | 3 | Configuración, cola | Tareas encoladas, resumen diario | — | Aprobar nada, superar el presupuesto |
| Lead Discovery | 3 | Filtros de configuración | Prospectos `DISCOVERED` | `DISCOVERED` | Usar fuentes bloqueadas, evadir restricciones |
| Business Research | 3 | Prospecto | Hechos con fuente, URL, fecha y confianza | `RESEARCHING`, `QUALIFIED`, `REJECTED` | Guardar un dato "verificado" sin URL de fuente |
| Website Audit | 3 ✔ | URL del sitio | Auditoría versionada: puntajes 0–100 por categoría medible, problemas, fortalezas, recomendación preliminar; contactos y tecnología como datos con fuente (captura: pendiente) | `AUDITED` | Usar lenguaje despectivo, puntuar lo que no midió, evadir robots.txt o bloqueos |
| Opportunity Scoring | 3 | Hechos + auditoría | Puntaje con explicación por criterio | `QUALIFIED`, `REJECTED` | Presentar probabilidades como certezas |
| ~~Concept & Demo~~ | — | — | **Retirado por decisión tomada el 29/09/2026.** Los estados `DEMO_GENERATING` y `DEMO_READY` quedan en desuso | — | — |
| Outreach | 4 ✔ | Prospecto + auditoría + datos | Asuntos, email HTML y texto, versiones por canal, sugerencia de canal y horario | `OUTREACH_READY` | Enviar nada, inventar elogios |
| Email Design | 4 | Mensaje | Email HTML + texto plano | — | Scripts, falsas urgencias |
| Project Builder | 5 | Aprobación de proyecto | Alcance, plan, código | `BUILDING`, `STAGING` | Arrancar sin la aprobación "APROBAR Y COMENZAR PROYECTO" |
| QA & Security | 5–6 | Proyecto | Reporte de tests y hallazgos | `QA` | Marcar terminado con fallas críticas o altas |

Los cambios de estado **comerciales** (marcar enviado, registrar respuesta, aprobar proyecto,
publicar) son solamente humanos. Esto está implementado en `src/domain/pipeline.ts`.

## Operación autónoma (etapa 3)

- **Dónde corre:** un proceso worker separado del panel, en el mismo servidor o en otro.
- **Qué lo dispara:** un scheduler con los horarios definidos en Configuración.
- **Límites:** antes de cada tarea, el orquestador compara el gasto del mes (suma de
  `agent_runs.cost_usd`) contra el presupuesto configurado, y el tope diario de leads.
  Si se alcanza un tope, la tarea queda en cola y se registra el motivo.
- **Reintentos:** hasta 3 intentos con espera creciente. Después, la tarea queda como fallida
  y aparece en "Tareas bloqueadas" del panel.
