# 07 · Sitio web del cliente

El panel arma el sitio del cliente **cuando ya es cliente** (estado *Proyecto aprobado* o posterior),
con su logo, sus colores y sus fotos, y con su autorización registrada. Antes de eso la pestaña
**Sitio web** está bloqueada: no se usan marcas ajenas sin permiso ni se gasta en empresas que no compraron.

## Paso a paso

1. **Oportunidades → la empresa → Sitio web.**
2. **Logo y fotos del cliente:** subí el logo (PNG, idealmente con fondo transparente) y fotos reales del negocio
   (JPG, PNG o WebP, hasta 3 MB cada una). SVG no se acepta porque puede traer código. Cada foto lleva una
   descripción (accesibilidad y buscadores). El tipo real del archivo se comprueba por su contenido.
3. **Ficha del sitio:** cómo te autorizó el cliente, colores (principal, fondo, texto y secundario), fuentes,
   textos, servicios, contacto, botón principal, fotos y descripción para Google. Cada vez que guardás se crea
   una **versión nueva**; las anteriores quedan intactas.
4. **Pulir textos con IA** (opcional, si configuraste Claude): reescribe los textos para que suenen
   profesionales **sin agregar datos**. Si la respuesta agrega números que no estaban, cambia la cantidad de
   servicios o usa frases de plantilla, se descarta. Si pasa, queda como una ficha nueva para que la revises.
   Costo máximo aproximado: US$ 0,10 por pedido, dentro del presupuesto mensual.
5. **Generar sitio:** arma HTML y CSS con la plantilla profesional y corre el **control de calidad**.
6. **Ver vista previa** (se abre aislada, sin scripts) y **Descargar sitio (.zip)**: `index.html`, `styles.css`
   e `img/`. Listo para subir a cualquier hosting. **Solo se puede descargar si no hay fallas.**

La primera versión generada pasa el proyecto de *Proyecto aprobado* a *En construcción*.
Publicar en el dominio del cliente sigue siendo una acción tuya, con su aprobación.

## Qué garantiza el control de calidad

| Control | Falla si… |
|---|---|
| Contraste (WCAG AA, 4,5:1) | el texto no se lee sobre el fondo |
| Canal de contacto y botón | no hay WhatsApp, teléfono ni email, o el botón apunta a un dato vacío |
| Fotos | una foto no tiene descripción |
| Textos naturales | hay frases de plantilla («soluciones innovadoras», «al siguiente nivel»…), marcadores sin completar (`[email]`, `TODO`, lorem ipsum), emojis o menciones a IA |

Además avisa (sin bloquear) si falta logo o es chico, si un color se ajustó para que se lea, si hay mayúsculas
al estilo inglés en títulos, rayas (—) o exclamaciones de más, o textos muy cortos.

Los colores del cliente se respetan tal cual. Solo si un color no se lee como texto o en un botón, se oscurece
lo mínimo necesario **en ese uso** y el control lo avisa.

## Sin rastro de IA

- El código entregado no tiene comentarios, metadatos ni créditos de la agencia o de herramientas.
- Sin JavaScript: HTML y CSS a mano, rápidos y accesibles (menú de celular con `<details>`).
- Sin fotos de stock ni íconos genéricos de IA: se usan las fotos del cliente o ninguna.
- Sin datos inventados: no hay testimonios, cifras ni premios salvo que el cliente los cargue.

## Fuentes

Se usan fuentes de Google Fonts (verificadas el 30/09/2026) o las del sistema. Si el cliente tiene manual de
marca, elegí la suya o la más parecida.

## Copia de seguridad

La copia completa incluye las fichas, los sitios generados y los datos de cada imagen (tipo, medidas, huella
sha256), pero **no el contenido de las imágenes**, para que el archivo no pese cientos de MB. Las imágenes quedan
en la base de datos; guardá también los originales que te mandó el cliente.
