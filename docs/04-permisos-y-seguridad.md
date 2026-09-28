# 04 · Permisos y seguridad

## Roles

| Permiso | Propietario | Operador | Solo lectura | Agente |
|---|:-:|:-:|:-:|:-:|
| Ver prospectos | ✔ | ✔ | ✔ | ✔ |
| Crear y editar prospectos | ✔ | ✔ | — | ✔ |
| Cambiar estado | ✔ | ✔ (con límites) | — | ✔ (solo etapas internas) |
| Cargar datos con fuente | ✔ | ✔ | — | ✔ |
| Escribir notas | ✔ | ✔ | — | — |
| Pedir aprobaciones | ✔ | ✔ | — | ✔ |
| **Decidir aprobaciones** | ✔ | — | — | — |
| Cambiar configuración | ✔ | — | — | — |
| Gestionar usuarios | ✔ | — | — | — |
| Ver actividad | ✔ | — | — | — |

Definido en `src/domain/permissions.ts`. Cada servicio lo verifica por su cuenta: ocultar un botón
en el panel no es una barrera de seguridad.

### Cambios de estado reservados

- **Solo personas:** marcar enviado, registrar respuestas, propuesta, negociación y cierre.
  Un agente jamás puede marcar un mensaje como enviado.
- **Solo el propietario:** "Aprobar y comenzar proyecto" (`APPROVED`), publicar (`DEPLOYED`)
  y reabrir un descartado.
- **Publicar** además exige una aprobación `deploy_production` aprobada, que se consume al usarla.
- Un prospecto **pausado** no puede ser movido por agentes.

## Aprobaciones humanas (sección 4.2)

Las 16 acciones sensibles del documento maestro están en `src/domain/approvals.ts`.
Un agente o un operador puede **pedirlas**; solo el propietario las **decide**.

- Rechazar exige una nota.
- Borrar datos de producción exige **dos personas distintas**. La misma persona aprobando
  dos veces no cuenta doble; la base lo impide con una clave primaria.
- Las solicitudes pueden vencer.
- Una solicitud resuelta no se puede volver a decidir.

## Autenticación

| Medida | Detalle |
|---|---|
| Contraseñas | bcrypt costo 12; mínimo 12 caracteres con letras y números |
| Primer usuario | Solo por consola (`npm run user:create`). No hay credenciales por defecto |
| Bloqueo | 5 intentos fallidos bloquean la cuenta 15 minutos |
| Límite por IP | 20 intentos cada 15 minutos (en memoria; ver limitaciones) |
| Enumeración | Mismo mensaje y mismo tiempo para email desconocido y contraseña incorrecta |
| Sesiones | Token aleatorio de 256 bits; en la base solo su hash. Vencen a los 7 días o tras 12 h sin uso |
| Cookie | `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict` |
| Desactivar usuario | Corta todas sus sesiones al instante |
| Último propietario | No se puede desactivar |

## Protección de la aplicación (OWASP)

| Riesgo | Cómo se cubre |
|---|---|
| Inyección SQL | Todas las consultas parametrizadas (Drizzle / `sql` con parámetros). Búsquedas con `LIKE` escapan `%` y `_`. Tests con entradas maliciosas |
| XSS | React escapa todo el contenido. CSP con nonce por request, sin `unsafe-inline`. Los enlaces externos solo aceptan `http`/`https` |
| CSRF | Server Actions comparan `Origin` con `Host` (Next.js) y la cookie es `SameSite=Strict` |
| Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` |
| Control de acceso | Autorización en cada servicio; tests por rol |
| Validación | Zod en el servidor para toda entrada; restricciones en la base como segunda capa |
| Secretos | `.env` excluido de git; los logs pasan por `redact()`, que oculta claves como `password`, `token`, `apiKey` |
| Indexación | `X-Robots-Tag: noindex`, `robots.txt` con `Disallow: /` y metadatos `noindex` |
| Errores | Los mensajes al usuario nunca exponen detalles internos |
| Dependencias | `npm audit`: 0 vulnerabilidades al 28/09/2026 |

## Limitaciones conocidas

1. El límite por IP vive en memoria: con varias instancias del servidor, cada una cuenta por separado.
   El bloqueo por cuenta sí está en la base y es global.
2. No hay segundo factor (2FA). Recomendado antes de exponer el panel a internet.
3. No hay recuperación de contraseña por email todavía: un propietario crea una cuenta nueva o
   se usa la consola. Se agrega cuando haya un proveedor de email aprobado.
4. La zona horaria de las fechas en pantalla está fija en Buenos Aires. La de "encontradas hoy"
   sí sale de la configuración.
