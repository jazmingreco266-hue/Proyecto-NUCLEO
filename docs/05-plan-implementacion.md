# 05 · Plan de implementación

## Estado al 28/09/2026

| Etapa | Estado |
|---|---|
| 1 · Auditoría | ✔ Hecha: repositorio vacío, sin sistema previo (ver `01-auditoria.md`) |
| 2 · Núcleo operativo | ✔ Hecha, con tests (detalle abajo) |
| 3 · Prospección | Pendiente: necesita decisiones del propietario (ver "Preguntas agrupadas") |
| 4 · Demos y comunicación | Pendiente |
| 5 · Ejecución de proyectos | Pendiente |
| 6 · Seguridad, migración y SEO | Pendiente |
| 7 · Ventas adicionales | Pendiente |

## Etapa 2: qué quedó hecho

- [x] Esquema de datos con restricciones de veracidad y registros inmutables
- [x] Migrador con checksum
- [x] Usuarios, roles y sesiones seguras
- [x] Pipeline de 25 estados con reglas por actor y control de versión
- [x] Aprobaciones humanas, con doble aprobación para borrar datos de producción
- [x] Hechos con fuente, URL, fecha, confianza y estado
- [x] Notas, pausa y descarte
- [x] Configuración con límites y su historial
- [x] Registro de actividad
- [x] Panel: vista general, tabla de oportunidades con filtros, ficha con 13 pestañas,
      aprobaciones, configuración, usuarios y actividad
- [x] Adaptado a celular, modo oscuro y claro
- [x] Mensajes a la empresa (adelantado de la etapa 4): tres asuntos, email en texto y HTML,
      WhatsApp, formulario y redes, canal y horario sugeridos, versiones que no se sobrescriben,
      copiar y descargar. Se marcan como enviados al pasar el prospecto a "Enviado manualmente"
- [x] Perfil de cliente ideal en Configuración: rubros objetivo, empleados y valor mínimo del proyecto
- [x] 90 tests automáticos + recorrido en navegador real

Los mensajes hoy se arman con lo que escribís de tu investigación (algo positivo real,
la oportunidad concreta y el beneficio). En la etapa 3, el agente de IA va a completar
esos mismos campos citando sus fuentes, y vos solo revisás.

Las pestañas de la ficha que dependen de etapas futuras (auditoría, capturas, demo,
propuesta, presupuesto detallado, proyecto técnico, seguridad y SEO) muestran qué
van a contener y en qué etapa llegan. No muestran datos inventados.

## Etapa 3: tareas pequeñas y verificables

Cada tarea se da por terminada con sus tests y su integración al panel.

1. **Worker y cola.** Proceso separado que toma trabajos de `agent_runs` con
   `FOR UPDATE SKIP LOCKED`, reintenta con espera creciente y respeta horario y topes.
   *Verificación:* tests de concurrencia (dos workers no toman el mismo trabajo) y de topes.
2. **Control de costos.** Antes de cada trabajo, sumar el gasto del mes y frenar si supera
   el presupuesto. *Verificación:* test con presupuesto 0 → no corre nada.
3. **Lectura respetuosa de sitios.** Cliente HTTP que lee `robots.txt`, se identifica, limita
   la velocidad por dominio y no evade logins, CAPTCHAs ni bloqueos.
   *Verificación:* tests con un servidor local que prohíbe rutas.
4. **Auditoría técnica objetiva.** Métricas medibles sin IA: HTTPS, viewport móvil, tiempos,
   títulos y meta descripciones, enlaces rotos, peso de imágenes.
   *Verificación:* contra sitios de prueba locales con problemas conocidos.
5. **Capturas.** Navegador headless en el servidor para escritorio y celular.
6. **Investigación con IA.** El agente extrae hechos **solo** de las páginas leídas y cita la
   URL de cada uno. Todo lo que no salga de una página queda como inferencia o hipótesis.
7. **Puntaje de oportunidad.** Por criterio, con explicación, guardado en `score_explanation`.
8. **Descubrimiento de empresas.** Depende de la fuente elegida (ver preguntas).
9. **Deduplicación** por dominio (ya existe) y por nombre + ciudad.
10. **Panel:** pestañas de Auditoría y Capturas, y la sección "Tareas bloqueadas".

## Preguntas agrupadas para el propietario

Estas decisiones afectan dinero, terceros o credenciales, así que no las tomo solo
(sección 17 del documento maestro).

1. **Hosting.** ¿Dónde se va a desplegar el panel y el worker? Necesita Node 22 y PostgreSQL 16.
   Contratar hosting es una acción que requiere tu aprobación.
2. **Proveedor de IA para los agentes.** ¿Con qué cuenta y API key? La clave va como variable de
   entorno del servidor, nunca en el código. ¿Presupuesto mensual inicial?
3. **Fuentes de descubrimiento.** Opciones típicas: Google Places API (paga por consulta y exige
   atribución), directorios empresariales con API o carga manual asistida.
   ¿Cuál preferís probar primero y con qué presupuesto?
4. **Mercados iniciales.** ¿Arrancamos solo por Argentina? ¿Qué ciudades y rubros?
5. **Segundo factor (2FA)** para entrar al panel antes de publicarlo en internet: ¿lo querés
   en la etapa 3?

## Bloqueos registrados

| Qué | Por qué | Alternativas | Requiere aprobación |
|---|---|---|---|
| Operación 24/7 | Hace falta un servidor desplegado | Hosting administrado (paga) o un VPS propio | Sí: contratar hosting |
| Agentes con IA | Hace falta una API key con presupuesto | Arrancar con auditoría técnica sin IA (tareas 1–5) | Sí: gasto |
| Descubrimiento automático | Hace falta elegir una fuente legítima | Carga manual (ya funciona) | Sí si la fuente es paga |
