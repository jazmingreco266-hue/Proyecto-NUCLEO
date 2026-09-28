# 06 · Publicar e instalar el panel

El panel necesita dos cosas para funcionar en internet: un servidor (Vercel) y una base de datos
PostgreSQL. Con eso queda en una dirección propia, con login, y lo podés instalar como app en tu
computadora, tablet y celular.

## Antes de empezar: plan de Vercel

Según la documentación de Vercel, el plan gratuito **Hobby es solo para uso personal no comercial**.
Como Núcleo es un negocio, corresponde el plan **Pro**. Revisá los precios vigentes en
https://vercel.com/pricing antes de contratar.

## Paso a paso

### 1. Unir la rama al código principal
En GitHub, abrí el repositorio `Proyecto-NUCLEO`, creá un *pull request* desde la rama
`etapa-1-2-nucleo` hacia `main` y unilo (*Merge*).

### 2. Crear el proyecto en Vercel
1. En Vercel: **Add New → Project**.
2. Importá el repositorio `Proyecto-NUCLEO`.
3. Vercel detecta Next.js. El archivo `vercel.json` ya indica el comando de build, que primero
   actualiza la base de datos y después compila.
4. Todavía no publiques: primero van la base y las variables.

### 3. Crear la base de datos
En el proyecto de Vercel, pestaña **Storage**, creá una base **Postgres** desde el Marketplace
(por ejemplo, Neon) y conectala al proyecto. Al conectarla se carga sola la variable `DATABASE_URL`.
Confirmá que exista en **Settings → Environment Variables**. Revisá el plan de la base al crearla.

### 4. Cargar las variables secretas
En **Settings → Environment Variables**, agregá (para *Production*):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La carga la base del paso 3 |
| `SETUP_TOKEN` | Un código largo que solo vos sepas (mínimo 16 caracteres). Sirve una sola vez |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 32 bytes aleatorios en base64 |

Para generar la clave, en cualquier computadora con Node.js:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Si no tenés Node, pedímela y te explico otra forma.

### 5. Publicar
Hacé **Deploy**. Si el build falla en el paso de migración, casi siempre es porque falta `DATABASE_URL`.

### 6. Crear tu cuenta
Entrá a la dirección que te da Vercel. Como no hay usuarios, el login muestra
**Crear la cuenta de propietario**. Poné el `SETUP_TOKEN`, tu nombre, email y contraseña.
Apenas se crea la cuenta, esa página deja de existir. Después podés borrar `SETUP_TOKEN`.

## Agentes en segundo plano (opcional)

Las auditorías pedidas desde el panel se ejecutan al momento, sin nada extra. Para que los agentes
trabajen solos (reintentos y auditorías automáticas de prospectos calificados) hay dos caminos:

| Opción | Cómo | Nota |
|---|---|---|
| Servidor propio o VPS | `npm run worker` como servicio | Corre sin parar y respeta el horario configurado |
| Vercel Cron | Cargá `CRON_SECRET` (16+ caracteres) y programá una llamada a `/api/cron/agentes` | Cada llamada trabaja hasta 45 s. Revisá la frecuencia que permite tu plan en https://vercel.com/docs/cron-jobs |

En ambos casos, en **Configuración** subí la autonomía de "Manual" a "Asistido" para que el
orquestador encole trabajo por su cuenta. Mientras esté en manual, solo corre lo que pidas vos.

## Instalarlo como app

| Dispositivo | Cómo |
|---|---|
| Computadora con Chrome o Edge | Abrí el panel y usá el ícono de instalar de la barra de direcciones |
| iPad o iPhone (Safari) | Compartir → **Agregar a inicio** |
| Tablet o celular Android (Chrome) | Menú ⋮ → **Instalar app** o **Agregar a la pantalla principal** |

Se abre en su propia ventana, con el ícono de Núcleo. Los datos siempre se leen del servidor:
el panel no guarda copias en el dispositivo, así que si perdés la tablet no se pierde ni se filtra nada.

## Cómo se protege lo que guardás

- Cada cambio se guarda en PostgreSQL dentro de una transacción: o se guarda completo o no se guarda.
- Si dos personas editan lo mismo a la vez, el panel lo detecta y no pisa el trabajo de nadie.
- El historial y la actividad no se pueden borrar.
- Los prospectos no se borran de verdad: se retiran y quedan en la base.
- **Copia de seguridad:** en **Configuración → Descargar copia** bajás todos los datos en un archivo
  (sin contraseñas). Conviene hacerlo seguido y guardarlo en un lugar privado.
- Además, revisá qué copias automáticas ofrece el plan de tu base de datos.
