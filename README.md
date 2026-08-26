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

La sección "Funciones para una segunda etapa" más abajo describe cómo
evolucionar esto hacia un backend real.

## Activar "Continuar con Google"

El botón de Google Sign-In usa Google Identity Services y funciona sin
ningún paquete extra, pero necesita un Client ID propio:

1. Andá a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials).
2. Creá un **ID de cliente de OAuth 2.0** de tipo "Aplicación web".
3. En "Orígenes de JavaScript autorizados" agregá la URL donde corre la app
   (por ejemplo `http://localhost:5173` en desarrollo, y el dominio real en
   producción).
4. Copiá el Client ID y creá un archivo `.env.local` (a partir de
   `.env.example`) con:
   ```
   VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
   ```
5. Reiniciá `npm run dev`.

Sin esta variable configurada, el botón de Google se reemplaza por un aviso
y la app sigue funcionando normalmente con email + contraseña.

**Nota de seguridad:** como esta versión no tiene backend, el token de
Google se decodifica en el cliente solo para leer nombre/email/foto
(`src/lib/googleAuth.ts`). En una versión con servidor, ese token debe
verificarse del lado del backend (firma, audiencia y expiración) antes de
confiar en sus datos.

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
no sobrecargarla): backend real con sincronización multi-dispositivo,
notificaciones push persistentes (hoy los recordatorios de medicación usan
la Notification API del navegador, que solo avisa con la app abierta),
escaneo de recetas/estudios, dictado por voz, módulo específico de cáncer
de mama, integración con Google Health Connect / Apple Health, modo
offline real (service worker), y verificación server-side del login con
Google.
