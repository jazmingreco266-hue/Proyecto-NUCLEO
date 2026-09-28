# 01 · Auditoría del sistema actual

**Fecha:** 2026-09-28
**Repositorio:** `jazmingreco266-hue/Proyecto-NUCLEO`, rama `main`, commit `57b56b7` ("Initial commit")

## Qué existe

| Área | Estado encontrado |
|---|---|
| Archivos | Un solo archivo: `README.md`, con el título `# Proyecto-NUCLEO` |
| Frontend / panel | No existe |
| Backend / APIs | No existe |
| Base de datos | No existe |
| Autenticación, permisos | No existe |
| Workers, colas, scheduler | No existe |
| Variables de entorno | No existe ningún `.env` ni ejemplo |
| Tests | No existen |
| Dependencias | Ninguna |
| Hosting / deployment | No hay configuración en el repositorio |
| Página promocional pública | **No está en este repositorio** |

## Diagnóstico

No hay un sistema previo, así que no hay nada que conservar, corregir ni migrar.
Se construye desde cero, respetando las reglas del documento maestro.

### Sobre la página promocional

El documento maestro prohíbe modificar la web promocional pública. Como no está en este
repositorio, este trabajo no la toca. Si existe en otro repositorio o hosting, sigue intacta.
La aplicación de este repo es **solamente el panel operativo** y su raíz (`/`) redirige al login.

## Riesgos detectados desde el inicio

1. **Autonomía 24/7:** requiere un servidor propio desplegado. Desplegar implica hosting,
   costos y credenciales, así que necesita aprobación del propietario (sección 4.2).
2. **Descubrimiento de leads:** depende de fuentes públicas con APIs y términos de uso
   propios (por ejemplo, Google Places, que exige mostrar atribución y tiene costo por consulta).
   Cada fuente se debe evaluar antes de conectarla (etapa 3).
3. **Capturas de sitios de terceros:** requieren un navegador headless en el servidor
   y respetar `robots.txt` y los términos de cada sitio (etapa 3–4).
4. **Costos de IA:** cada investigación y demo consume tokens. Sin topes configurables,
   el gasto puede descontrolarse. Por eso la etapa 2 ya incluye límites y registro de costo.
