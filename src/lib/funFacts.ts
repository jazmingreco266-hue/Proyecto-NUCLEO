export const FUN_FACTS: string[] = [
  'Reírse 10 minutos genuinamente puede bajar la percepción del dolor por un rato. Hoy, una excusa más para ver algo que te haga reír.',
  'Escuchar música que te gusta libera dopamina, la misma sustancia asociada al placer. Armate una playlist para los días difíciles.',
  'Los tratamientos oncológicos avanzan cada año: hoy existen terapias que hace una década ni existían.',
  'Una caminata corta y suave puede mejorar el ánimo tanto como algunos otros hábitos saludables, siempre que tu equipo médico la autorice.',
  'Hablar de lo que sentís, aunque sea con una sola persona de confianza, reduce la sensación de carga emocional.',
  'El cuerpo humano genera millones de células nuevas todos los días: es una máquina que no deja de intentar repararse.',
  'Dormir bien (cuando el cuerpo lo permite) ayuda al sistema inmune a hacer mejor su trabajo.',
  'Tener una rutina simple, aunque sea pequeña, le da al cerebro una sensación de control que ayuda a bajar la ansiedad.',
  'Los grupos de apoyo, presenciales u online, están asociados a una mejor calidad de vida durante tratamientos largos.',
  'Acariciar a una mascota (si tenés y podés) baja medibles de estrés en minutos.',
  'El humor, incluso en momentos difíciles, es una herramienta válida y sana para atravesar procesos largos.',
  'Cada persona que atraviesa un tratamiento oncológico lo hace a su propio ritmo: no hay una forma "correcta" de sentirlo.',
  'Pequeños logros del día (comer algo rico, salir a tomar aire) también cuentan como victorias.',
  'Tomar agua regularmente ayuda a que el cuerpo tolere mejor muchos tratamientos. Un vaso más, un logro más.',
  'Pedir ayuda no es rendirse: los equipos que incluyen psico-oncología reportan mejor bienestar en pacientes y familias.',
  'El sol de la mañana (con cuidado y protección) ayuda a regular el reloj biológico y puede mejorar el sueño.',
  'Anotar tres cosas buenas del día, por chiquitas que sean, es una práctica simple con buena evidencia sobre el ánimo.',
  'Las familias que se organizan en tareas concretas (turnos, traslados, comidas) suelen sentir menos agotamiento acumulado.',
  'Respirar lento y profundo durante un minuto puede bajar la frecuencia cardíaca y la sensación de ansiedad.',
  'Vos no sos tu diagnóstico. Sos vos, atravesando algo difícil, con toda tu historia alrededor.',
]

export function funFactOfTheDay(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return FUN_FACTS[dayOfYear % FUN_FACTS.length]
}
