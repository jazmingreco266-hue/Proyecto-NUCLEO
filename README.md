# Núcleo · Panel operativo

Panel privado para encontrar empresas con oportunidades de modernización digital, registrar
todo lo que se sabe de ellas **con su fuente**, seguir el proceso comercial y aprobar cada acción
sensible antes de que ocurra.

> Este repositorio contiene solo el panel operativo. La web pública de Núcleo no está acá
> y no se modifica.

**Para publicarlo e instalarlo en tu computadora o tablet, seguí [docs/06-publicar.md](docs/06-publicar.md).**

## Qué hay hoy (etapa 2)

- Pipeline comercial de 25 estados, con historial imposible de editar.
- Cada dato de una empresa lleva fuente, URL, fecha, confianza y estado
  (verificado / probable / no verificado). La base rechaza datos "verificados" sin fuente.
- Aprobaciones humanas para enviar, pagar, publicar, cambiar DNS o borrar.
  Borrar datos de producción necesita dos personas.
- Roles: propietario, operador y solo lectura.
- Configuración de límites para los agentes, con historial.
- Registro de actividad completo.

Los agentes automáticos llegan en la etapa 3. Ver [`docs/05-plan-implementacion.md`](docs/05-plan-implementacion.md).

## Puesta en marcha

Requisitos: Node 22.9 o superior y PostgreSQL 16.

```bash
npm install
cp .env.example .env          # completá DATABASE_URL
npm run db:migrate            # crea las tablas
npm run user:create -- --email vos@empresa.com --name "Tu nombre" --role owner
npm run dev                   # http://localhost:3000
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
