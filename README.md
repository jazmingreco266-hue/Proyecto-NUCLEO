# Núcleo · Panel operativo

Panel privado para encontrar empresas con oportunidades de modernización digital, registrar
todo lo que se sabe de ellas **con su fuente**, seguir el proceso comercial y aprobar cada acción
sensible antes de que ocurra.

> Este repositorio contiene solo el panel operativo. La web pública de Núcleo no está acá
> y no se modifica.

**Para publicarlo e instalarlo en tu computadora o tablet, seguí [docs/06-publicar.md](docs/06-publicar.md).**

## Qué hay hoy (etapas 3 y 4, primer bloque)

- Pipeline comercial de 25 estados, con historial imposible de editar.
- Cada dato de una empresa lleva fuente, URL, fecha, confianza y estado
  (verificado / probable / no verificado). La base rechaza datos "verificados" sin fuente.
- Aprobaciones humanas para enviar, pagar, publicar, cambiar DNS o borrar.
  Borrar datos de producción necesita dos personas.
- Roles: propietario, operador y solo lectura.
- Configuración de límites para los agentes, con historial.
- Registro de actividad completo.
- **Auditoría web técnica** desde la ficha de cada prospecto: lee el sitio respetando `robots.txt`,
  mide seguridad, experiencia móvil, velocidad, SEO técnico, accesibilidad, contacto, actualización,
  integraciones y enlaces rotos. Solo puntúa lo medible; lo que requiere criterio queda "no evaluado".
  Cada auditoría es una versión nueva, nunca se sobrescribe.
- Contactos y tecnología encontrados en el sitio se guardan como datos con fuente y fecha.
- **Investigación con IA (Claude)** desde la pestaña Investigación: lee hasta 5 páginas públicas del
  sitio y extrae datos del negocio. Un dato "observado" solo se guarda si la cita que lo respalda
  aparece textual en la página; lo que no se puede comprobar se descarta y se muestra. Todo queda como
  probable o no verificado hasta que lo confirmes. Cada llamada registra su costo real.
- **Puntaje de oportunidad** explicado criterio por criterio, solo con criterios que tienen datos.
- **Mensajes preparados** a partir de la auditoría: tres asuntos, email HTML y texto, WhatsApp, formulario y
  redes, canal y horario sugeridos. No se generan demos. El sistema nunca envía: vos copiás, enviás y marcás como enviado.
- **Finanzas** (solo propietario): ventas y gastos que **no se pueden editar ni borrar** (se marcan cobrados o
  pagados, o se anulan con motivo), gráfico de ventas, gastos y resultado de 12 meses, balance simplificado y
  **Excel** con ventas, gastos, resultado mensual (con fórmulas), balance y presupuestos.
- **Cotizador**: presupuestos con tu lista de precios y total en vivo; versión para imprimir o guardar en PDF;
  un presupuesto aceptado se registra como venta con un clic.
- **Chatbots y bases de datos** como servicios: el cotizador admite abonos mensuales, cada empresa muestra si le
  serviría un chatbot o una base de datos (con el dato que lo motivó, como hipótesis), los mensajes lo mencionan
  cuando hay señales y el puntaje de oportunidad lo tiene en cuenta.
- **Portafolio** de trabajos terminados (sitios, chatbots, bases de datos, sistemas), con autorización del cliente.
- **Copia de seguridad** completa (JSON) y aviso si pasó más de una semana desde la última.
- **Cola de agentes** con reintentos, control de presupuesto, horario y nivel de autonomía,
  y la página **Tareas** para ver, reintentar o cancelar trabajos.

Lo que falta y lo que necesita tu decisión: [`docs/05-plan-implementacion.md`](docs/05-plan-implementacion.md).

## Puesta en marcha

Requisitos: Node 22.9 o superior y PostgreSQL 16.

```bash
npm install
cp .env.example .env          # completá DATABASE_URL
npm run db:migrate            # crea las tablas
npm run user:create -- --email vos@empresa.com --name "Tu nombre" --role owner
npm run dev                   # http://localhost:3000
npm run worker                # opcional: agentes en segundo plano (ver docs/06-publicar.md)
```

Para producción:

```bash
npm run build
npm start
```

### Datos de ejemplo (opcional, solo desarrollo)

```bash
npm run seed:ejemplo              # 4 empresas ficticias con dominios .example
npm run seed:ejemplo -- --borrar  # las retira
```

Quedan marcadas como **Ejemplo** en todo el panel y no suman a las métricas.

## Tests

```bash
# Necesitan una base de prueba separada (su nombre debe contener "test").
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/nucleo_test npm test
npm run typecheck
```

## Documentación

| Documento | Contenido |
|---|---|
| [01 · Auditoría](docs/01-auditoria.md) | Qué había en el repositorio y riesgos iniciales |
| [02 · Arquitectura](docs/02-arquitectura.md) | Stack, capas y mapa de agentes |
| [03 · Esquema de datos](docs/03-esquema-datos.md) | Tablas y reglas de la base |
| [04 · Permisos y seguridad](docs/04-permisos-y-seguridad.md) | Roles, aprobaciones, OWASP y limitaciones |
| [05 · Plan](docs/05-plan-implementacion.md) | Etapas, tareas y preguntas pendientes |
| [06 · Publicar e instalar](docs/06-publicar.md) | Vercel, base de datos, primera cuenta e instalación como app |
