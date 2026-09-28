# 03 · Esquema de datos

La fuente de verdad es [`migrations/0001_nucleo.sql`](../migrations/0001_nucleo.sql).
`src/db/schema.ts` es su espejo tipado para el código.

## Tablas

| Tabla | Para qué | Reglas que impone la base |
|---|---|---|
| `users` | Personas del panel con rol `owner`, `operator` o `viewer` | Email único sin distinguir mayúsculas |
| `sessions` | Sesiones activas | Guarda el **hash** SHA-256 del token, nunca el token |
| `prospects` | Empresas detectadas | Dominio único entre prospectos vivos; puntajes entre 0 y 100; montos no negativos; `version` para detectar ediciones simultáneas; `is_sample` marca datos de ejemplo; borrado lógico con `deleted_at` |
| `prospect_facts` | Cada dato de una empresa con fuente, URL, fecha, confianza y estado | Ver "Veracidad en la base" abajo |
| `pipeline_events` | Historial de cambios de estado: fecha, actor, motivo, acción, resultado y próximo paso | Motivo obligatorio. **Solo agregado** |
| `approvals` | Solicitudes de acciones sensibles | 1 o 2 aprobaciones requeridas |
| `approval_decisions` | Quién aprobó o rechazó | Una decisión por persona por solicitud. **Solo agregado** |
| `notes` | Notas del equipo sobre un prospecto | No vacías; borrado lógico |
| `settings` | Configuración vigente (una sola fila) | `id = 1` fijo |
| `settings_history` | Cada versión de la configuración | **Solo agregado** |
| `audit_log` | Registro de todo lo que pasa | **Solo agregado**; los metadatos se limpian de secretos antes de guardarse |
| `agent_runs` | Cola y registro de ejecuciones de agentes (etapa 3): modelo, herramienta, costo, tokens, intentos, error | Costo no negativo |

## Veracidad en la base (sección 4.1)

Además de la validación en el servidor, la base rechaza por sí misma:

- Un dato `verified` sin `source_url` y `verified_at`.
- Un dato `observed` (hecho observado) sin `source_url`.
- Una `inference` o `hypothesis` marcada como `verified`.

Así, aunque un agente futuro tenga un error, no puede guardar un dato inventado como verificado.

## Tablas de solo agregado

`pipeline_events`, `audit_log`, `approval_decisions` y `settings_history` tienen un trigger
que rechaza cualquier `UPDATE` o `DELETE`. Como consecuencia, un prospecto con historial
**no se puede borrar físicamente**: solo se retira con borrado lógico. Borrar datos de
producción de verdad queda reservado a un procedimiento con doble aprobación.

## Migraciones

- Archivos `NNNN_nombre.sql`, aplicados en orden, cada uno en su propia transacción.
- El migrador guarda el SHA-256 de cada archivo. Si alguien edita una migración ya aplicada,
  se niega a continuar. Los cambios siempre van en una migración nueva.
- Un candado de Postgres evita que dos procesos migren a la vez.
