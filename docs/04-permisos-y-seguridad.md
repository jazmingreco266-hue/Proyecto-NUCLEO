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

## Lectura de sitios de terceros (sección 4.3)

Implementado en `src/agents/http.ts` y probado en `tests/http.test.ts`.

| Regla | Cómo se cumple |
|---|---|
| Respetar robots.txt | Se lee antes de cada sitio y en cada redirección (RFC 9309). Si no se puede leer por error del servidor, no se lee el sitio |
| Identificarse | User-agent `NucleoBot/0.3`; con `BOT_CONTACT_URL` agrega un contacto |
| No hacer scraping agresivo | Mínimo 1,5 s entre pedidos al mismo dominio; respeta `Crawl-delay` (tope 10 s); como máximo 1 página + robots.txt + 8 enlaces por auditoría |
| No evadir bloqueos | 401, 403, 407, 429 y 451 se registran como bloqueo y **no se reintentan**. No envía cookies, no inicia sesión, no completa formularios |
| No llegar a la red interna (SSRF) | Solo http/https, sin credenciales en la URL, sin IPs directas. La IP resuelta se valida **al conectar**, lo que también frena un DNS que apunte a direcciones privadas |
| Límites de recursos | 15 s por pedido, 3 MB por respuesta, 5 redirecciones |
| Datos personales | Se guardan solo contactos empresariales publicados en el sitio. De LinkedIn solo páginas de empresa (`/company/`), nunca perfiles personales. No se guarda el HTML completo |

Los contactos encontrados quedan como **probables** (confianza 70): podrían ser, por ejemplo, del
diseñador del sitio. Una persona los confirma antes de usarlos.

## Investigación con IA

- La clave `ANTHROPIC_API_KEY` vive solo en las variables del servidor. Nunca en el código ni en la base.
- El texto de las páginas se envía marcado como contenido de terceros, y las instrucciones le indican a
  Claude que lo trate como datos, no como órdenes (defensa contra instrucciones escondidas en un sitio).
- La salida se valida con Zod en el servidor y se aplica la verificación de citas antes de guardar.
- A Claude solo se envía texto público del sitio de la empresa: ningún dato del panel, de usuarios ni
  notas internas.

## Agentes, costos y autonomía

- Un trabajo pedido por una persona desde el panel corre al momento. Uno automático respeta el nivel
  de autonomía (en **manual** no corre nada solo) y el horario configurado.
- Antes de cada trabajo con costo estimado se compara contra el presupuesto mensual. Con presupuesto 0
  (valor inicial) no corre ningún trabajo con costo. La auditoría técnica no usa APIs pagas: costo 0.
- El endpoint `/api/cron/agentes` exige `Authorization: Bearer <CRON_SECRET>` (comparación en tiempo
  constante). Sin la variable configurada responde 401 siempre.

## Limitaciones conocidas

1. El límite por IP vive en memoria: con varias instancias del servidor, cada una cuenta por separado.
   El bloqueo por cuenta sí está en la base y es global.
2. No hay segundo factor (2FA). Recomendado antes de exponer el panel a internet.
3. No hay recuperación de contraseña por email todavía: un propietario crea una cuenta nueva o
   se usa la consola. Se agrega cuando haya un proveedor de email aprobado.
4. La zona horaria de las fechas en pantalla está fija en Buenos Aires. La de "encontradas hoy"
   sí sale de la configuración.
5. El tiempo de respuesta de la auditoría es una sola medición desde el servidor de Núcleo. No
   reemplaza una prueba de Core Web Vitals con navegador.
6. La espera entre pedidos al mismo dominio vive en memoria de cada proceso: dos workers en paralelo
   sobre el mismo sitio no se coordinan. Con un solo worker (lo previsto) no aplica.
