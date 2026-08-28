# Núcleo

Una app para acompañar a pacientes oncológicos y a su familia durante el
tratamiento: agenda de quimio/radio/estudios, registro diario de síntomas y
ánimo con evolución por ciclos, medicación con recordatorios, círculo
familiar con código de acceso, carpeta de documentos con resumen en PDF para
el médico, contactos, plan de acción y un espacio de bienestar con fuentes
oficiales, testimonios y un fun fact positivo por día.

Nació para acompañar a mi mamá durante su tratamiento — la carta completa
está dentro de la app, en **Quiénes somos**.

## Filosofía del producto

Núcleo **organiza y acompaña**. A propósito, **no hace** ninguna de estas
cosas:

- No diagnostica ni interpreta estudios o análisis clínicos.
- No sugiere ni modifica tratamientos, dosis o medicación.
- No decide qué síntoma es una emergencia (eso lo define el plan de acción
  que carga el equipo médico).
- No promete curar nada con dietas, suplementos o prácticas alternativas.
- No muestra publicidad basada en datos de salud ni vende información a
  terceros.

El motor de "patrones" de la sección Registro → Evolución (`src/lib/insights.ts`)
es 100% local y heurístico: solo cruza los datos que la propia persona
registró (no llama a ningún servicio externo, no es un modelo de IA) y
siempre aclara que no es un diagnóstico.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Recharts (gráficos de evolución)
- jsPDF (resumen para el médico)
- date-fns
- lucide-react (iconos)
- vite-plugin-pwa (instalable + funciona sin conexión)
- Capacitor (envoltorio nativo para iOS/Android, ver más abajo)

## Cómo correrla

```bash
npm install
npm run dev
```

```bash
npm run build   # build de producción (tsc -b && vite build)
npm run lint     # oxlint
npm run preview  # sirve el build de dist/
```

## Persistencia de datos (importante)

Esta primera versión es **100% cliente**: todo se guarda en el
`localStorage` del navegador (capa aislada en `src/lib/storage.ts`, pensada
para poder reemplazarse por una API real sin tocar el resto de la app). Eso
implica, a propósito, algunas limitaciones que conviene conocer:

- Los datos viven en **este dispositivo/navegador**. Si el paciente usa la
  app desde el celular y la familia desde otra computadora, no van a ver
  automáticamente lo mismo (todavía no hay backend/sincronización).
- Para "mover" los datos a otro dispositivo o compartirlos con un familiar,
  usá **Privacidad → Descargar mis datos (JSON)**.
- Los documentos y fotos se guardan como `data URL` en `localStorage`, así
  que hay un límite práctico de tamaño por archivo (4 MB) y de espacio
  total (el límite típico de `localStorage` es de unos 5–10 MB).
- Las contraseñas se guardan hasheadas (SHA-256 + salteado) en el propio
  navegador, no en un servidor. Es razonable para una demo/primera versión,
  pero **no reemplaza una autenticación real de backend** para producción.
- Por lo mismo, "¿Olvidaste tu contraseña?" (`/recuperar`) no envía un email
  de verificación (no hay servidor que lo mande): alcanza con el email de la
  cuenta para fijar una nueva contraseña. La propia pantalla se lo explica
  al usuario y recomienda activar el PIN de la app.

La sección "Funciones para una segunda etapa" más abajo describe cómo
evolucionar esto hacia un backend real.

## Activar "Continuar con Google"

El botón de Google Sign-In usa Google Identity Services y funciona sin
ningún paquete extra, pero necesita un Client ID propio. Usá la cuenta
`nucleoweb.ar@gmail.com` para crearlo, así queda todo centralizado ahí:

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) con
   `nucleoweb.ar@gmail.com` y creá un proyecto nuevo (por ejemplo "Núcleo").
2. Andá a **APIs y servicios → Pantalla de consentimiento de OAuth**, elegí
   tipo "Externo", completá el nombre de la app ("Núcleo") y el mail de
   soporte (`nucleoweb.ar@gmail.com`). Con eso alcanza para probarlo (queda
   en modo "Prueba/Testing", que ya permite iniciar sesión).
3. Andá a **APIs y servicios → Credenciales** y creá un **ID de cliente de
   OAuth 2.0** de tipo "Aplicación web".
4. En "Orígenes de JavaScript autorizados" agregá **las dos** URLs donde
   corre la app:
   - `http://localhost:5173` (para probar en tu compu)
   - `https://jazmingreco266-hue.github.io` (el sitio publicado — sin la
     parte `/Proyecto-NUCLEO/` al final, Google solo pide el dominio)
5. Copiá el Client ID que te da Google (termina en
   `.apps.googleusercontent.com`).

**Para que funcione en tu compu (desarrollo):**

Creá un archivo `.env.local` (a partir de `.env.example`) con:

```
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

y reiniciá `npm run dev`.

**Para que funcione en el sitio publicado (GitHub Pages):**

El workflow de despliegue (`.github/workflows/deploy-pages.yml`) ya está
preparado para tomar el Client ID desde un secreto de GitHub. Solo falta
cargarlo una vez:

1. En GitHub, andá al repo → **Settings → Secrets and variables → Actions**.
2. Tocá **New repository secret**.
3. Nombre: `VITE_GOOGLE_CLIENT_ID`. Valor: el Client ID que copiaste arriba.
4. Guardá, y volvé a correr el workflow "Deploy a GitHub Pages" (pestaña
   **Actions** → seleccionalo → **Run workflow**), o simplemente hacé un
   nuevo push — el próximo build ya lo va a incluir.

Sin esta variable configurada (en local o en el secreto), el botón de
Google se reemplaza por un aviso y la app sigue funcionando normalmente
con email + contraseña.

**Nota de seguridad:** como esta versión no tiene backend, el token de
Google se decodifica en el cliente solo para leer nombre/email/foto
(`src/lib/googleAuth.ts`). En una versión con servidor, ese token debe
verificarse del lado del backend (firma, audiencia y expiración) antes de
confiar en sus datos.

## Activar el mail de confirmación (EmailJS)

Al crear una cuenta, la app intenta mandar un mail de bienvenida usando
[EmailJS](https://www.emailjs.com/), que permite enviar mails reales desde
el navegador sin necesidad de un servidor propio. Si no está configurado,
la cuenta se crea igual y solo se salta el envío del mail (no rompe nada).

1. Creá una cuenta gratis en [EmailJS](https://dashboard.emailjs.com/sign-up)
   usando `nucleoweb.ar@gmail.com`.
2. En **Email Services → Add New Service**, elegí **Gmail** y conectalo con
   `nucleoweb.ar@gmail.com` (te va a pedir iniciar sesión y dar permiso).
   Copiá el **Service ID** que te queda (algo como `service_xxxxxxx`).
3. En **Email Templates → Create New Template**, armá el mail de bienvenida.
   Usá estas variables exactas en el asunto/cuerpo (son las que manda el
   código, en `src/lib/email.ts`):
   - `{{to_name}}` — nombre de la persona que se registró
   - `{{to_email}}` — su email (también hay que ponerlo en el campo "To
     Email" de la configuración del template, arriba a la derecha)
   - `{{app_name}}` — siempre dice "Núcleo"

   Un ejemplo simple de cuerpo:
   ```
   Asunto: ¡Bienvenida/o a {{app_name}}!

   Hola {{to_name}},

   Tu cuenta en {{app_name}} ya está lista. Gracias por sumarte — este
   espacio está pensado para acompañarte a vos y a tu familia durante el
   tratamiento.

   Un abrazo,
   El equipo de Núcleo
   ```
   Guardá y copiá el **Template ID** (algo como `template_xxxxxxx`).
4. En **Account → General**, copiá tu **Public Key**.
5. Con esos tres valores, cargalos como secretos del repo en GitHub (Settings
   → Secrets and variables → Actions → New repository secret), uno por uno:
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`
6. Volvé a correr el workflow de despliegue (o hacé un push) para que el
   próximo build ya mande mails de verdad.

Para probarlo en tu compu, agregá las mismas tres variables a tu
`.env.local` (ver `.env.example`) y reiniciá `npm run dev`.

## Usarla en celular, tablet y compu (PWA, funciona sin WiFi)

Núcleo es una **Progressive Web App**: se puede instalar con ícono propio en
la pantalla de inicio y sigue funcionando sin conexión (un service worker
cachea toda la app la primera vez que se abre con internet).

- **Android (Chrome):** abrí la app → menú (⋮) → "Instalar app" o "Agregar a
  pantalla de inicio".
- **iPhone/iPad (Safari):** abrí la app → botón Compartir → "Agregar a
  inicio". iOS no soporta el mismo diálogo de instalación que Android, pero
  el resultado es equivalente: ícono propio, pantalla completa, funciona sin
  conexión.
- **Computadora (Chrome/Edge):** ícono de instalar en la barra de direcciones.

Esto ya cumple, para uso personal/familiar, el pedido de "que funcione desde
el celular, la tablet y la compu, sin WiFi, para Android y iOS": no requiere
cuentas de desarrollador, revisión de Apple/Google ni USD 99/año. Lo que
**no** da por sí sola es presencia en el App Store / Play Store — para eso
seguí la guía de abajo.

## El camino a las tiendas (App Store / Play Store)

Siguiendo el orden recomendado — **web completa → Capacitor → funciones
nativas → TestFlight/testing interno → tienda** — esto es lo que ya está
resuelto en el repo y lo que queda por hacer a mano:

### Ya hecho en el código

- ✅ **Paso 1 (app web completa):** login con email/contraseña y Google,
  recuperación de contraseña, política de privacidad pública (`/privacidad`),
  página de soporte (`/soporte`), responsive verificado en mobile (375px) y
  tablet (768px), sin errores de consola.
- ✅ **Paso 2 (Capacitor):** instalado y configurado (`capacitor.config.ts`).
  Las carpetas `android/` y `ios/` ya están generadas y commiteadas — no
  hace falta correr `cap add` de nuevo.
- ✅ **Paso 3 (funciones nativas mínimas)**, para que Apple no la vea como
  "una página web en una ventana" (ver
  [App Review Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)):
  - Funciona **sin conexión** (service worker + todos los datos en el
    dispositivo).
  - **Barra de estado nativa** con el color de marca (`@capacitor/status-bar`).
  - **Botón "atrás" de Android** integrado con la navegación de la app en
    vez de cerrarla (`@capacitor/app`).
  - **Compartir nativo**: el código del círculo familiar (Círculo → Compartir)
    abre la hoja de compartir del sistema operativo (`@capacitor/share`).

### Lo que falta y requiere una Mac + tus propias cuentas

Esto es exactamente lo que vos ya identificaste — no hay forma de saltearlo,
y no lo puedo hacer desde este entorno (sin macOS, sin poder pagar ni crear
cuentas a tu nombre):

1. **Cuenta Apple Developer** (USD 99/año) y, si vas a vender algo dentro de
   la app, considerá el
   [Small Business Program](https://developer.apple.com/app-store/small-business-program/)
   (comisión 15% en vez de 30%).
2. **Cuenta Google Play Console** (USD 25 una vez) si además vas a publicar
   en Android.
3. En una Mac con Xcode 26+:
   ```bash
   npm run cap:ios       # build + sync + abre Xcode
   npm run cap:android   # build + sync + abre Android Studio
   ```
   Ahí configurás nombre, ícono (ya generado en `public/`, ver abajo),
   Bundle ID (`ar.com.nucleoapp.app` en `capacitor.config.ts` — cambialo por
   el tuyo si querés otro), certificados y perfiles de firma.
4. **TestFlight** (iOS) o **testing interno de Play Console** (Android) para
   probar en un dispositivo real antes de publicar.
5. Ficha de la tienda: nombre, descripción, capturas de pantalla,
   categoría (Salud y bienestar / Medicina), clasificación por edad,
   [link a la política de privacidad](/privacidad) (ya pública, así que solo
   hay que pegar la URL una vez que la app esté desplegada), y la
   [página de soporte](/soporte).
6. Enviar a revisión desde Xcode/App Store Connect o Play Console.

### Íconos ya generados

En `public/`: `pwa-192x192.png`, `pwa-512x512.png`,
`maskable-icon-512x512.png` (para Android, con el margen de seguridad que
pide Google) y `apple-touch-icon.png`. Si en algún momento cambiás el logo,
regenerálos desde `favicon.svg` / `maskable-icon.svg` (por ejemplo con
`cairosvg` o cualquier conversor SVG → PNG) y corré `npm run cap:sync`.

### Después de tocar código

Cada vez que cambiés algo en `src/`, antes de abrir Xcode/Android Studio
corré:

```bash
npm run cap:sync
```

Esto hace `npm run build` y copia el resultado a `android/` e `ios/`.

## Estructura del proyecto

```
src/
  lib/            # auth, datos, storage, PDF, insights, contenido de Bienestar
  components/      # Layout, UI compartida (Button, Card, Modal, etc.)
  pages/           # una página por sección de la app
    auth/          # login, signup, onboarding de Google
```

Las 5 secciones principales (siguiendo la recomendación de mantener la
primera versión simple): **Hoy, Agenda, Registro, Mi carpeta, Contactos**.
Alrededor de esas, el acompañamiento: **Círculo familiar, Bienestar,
Galería**, y la cuenta: **Quiénes somos, Privacidad**.

## Privacidad y datos sensibles

En Argentina, los datos de salud son "datos sensibles" bajo la Ley 25.326.
La app incluye, desde esta primera versión:

- PIN de bloqueo local (además del login).
- Exportación completa de datos en un click.
- Eliminación de cuenta (y de los datos del círculo, si sos la última
  persona que los usa).
- Registro de accesos a acciones sensibles (PIN, exportación, etc.).
- Cero publicidad y cero venta de datos.

## Funciones para una segunda etapa

Quedan documentadas pero fuera de esta primera versión (a propósito, para
no sobrecargarla): backend real con sincronización multi-dispositivo (hoy
el círculo familiar y la recuperación de contraseña son "locales", ver
más abajo), notificaciones push persistentes (hoy los recordatorios de
medicación usan la Notification API del navegador, que solo avisa con la
app abierta), escaneo de recetas/estudios, dictado por voz, módulo
específico de cáncer de mama, integración con Google Health Connect / Apple
Health, cámara nativa para documentos, y verificación server-side del login
con Google.
