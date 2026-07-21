# Núcleo — Landing page

Landing page one-page de **Núcleo**, una agencia que sistematiza PyMEs:
toma el desorden operativo de una empresa (audios, planillas, documentos) y
lo transforma en un portal privado con manuales, procesos, plantillas y
calculadoras.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (theme CSS-first en `src/app/globals.css`)
- [Framer Motion](https://www.framer.com/motion/) para animaciones sutiles al hacer scroll
- [lucide-react](https://lucide.dev) para íconos lineales

## Estructura

```
src/
  app/
    layout.tsx      # metadata, SEO, Open Graph, fuente Inter
    page.tsx         # ensambla todas las secciones
    globals.css       # paleta, tipografía y tokens de Tailwind
  components/
    Navbar.tsx
    Hero.tsx
    PortalMockup.tsx  # mockup abstracto del portal (sin fotos de stock)
    Problem.tsx
    HowItWorks.tsx
    WhatYouGet.tsx
    ForWhom.tsx
    About.tsx          # Visión y Misión
    SocialProof.tsx     # testimonios y logos placeholder
    ContactForm.tsx     # formulario con envío simulado
    Footer.tsx
    ui/
      Container.tsx
      Reveal.tsx        # wrapper de Framer Motion (fade + translateY)
      Button.tsx
      Eyebrow.tsx
```

## Correr localmente

Requisitos: Node.js 18.18 o superior.

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

Otros comandos disponibles:

```bash
npm run build   # build de producción
npm run start   # sirve el build de producción
npm run lint    # corre ESLint
```

## Conectar el formulario de contacto

El formulario de la sección final (`src/components/ContactForm.tsx`) simula
el envío con un `setTimeout` y muestra un estado de éxito. Hay un `TODO` en
el archivo marcando dónde conectar un endpoint real (por ejemplo una route
handler propia en `src/app/api/contacto/route.ts`, o un servicio externo
como Resend / Formspree).

## Deploy en Vercel

1. Subí el repositorio a GitHub (o el proveedor que uses).
2. Entrá a [vercel.com/new](https://vercel.com/new) e importá el repositorio.
3. Vercel detecta Next.js automáticamente — no hace falta configuración
   adicional. Framework Preset: **Next.js**, Build Command: `next build`,
   Output: por defecto.
4. Deploy. Cada push a la rama principal genera un nuevo deploy.

También podés usar la CLI de Vercel:

```bash
npm i -g vercel
vercel
```
