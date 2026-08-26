export interface OfficialResource {
  title: string
  org: string
  url: string
  description: string
}

export const OFFICIAL_RESOURCES: OfficialResource[] = [
  {
    title: 'Guías para pacientes y cuidadores',
    org: 'American Cancer Society',
    url: 'https://www.cancer.org',
    description: 'Información revisada médicamente sobre tratamientos, efectos secundarios y apoyo al cuidador.',
  },
  {
    title: 'Cancer.Net',
    org: 'ASCO (Sociedad Americana de Oncología Clínica)',
    url: 'https://www.cancer.net',
    description: 'Contenido escrito y revisado por oncólogos, orientado a pacientes y familias.',
  },
  {
    title: 'Información sobre el cáncer',
    org: 'National Cancer Institute (NCI)',
    url: 'https://www.cancer.gov',
    description: 'Instituto oficial de EE.UU. con información sobre síntomas, efectos secundarios y ensayos clínicos.',
  },
  {
    title: 'Instituto Nacional del Cáncer',
    org: 'Ministerio de Salud de Argentina',
    url: 'https://www.argentina.gob.ar/salud/instituto-nacional-del-cancer',
    description: 'Recursos, programas y líneas de contacto para pacientes oncológicos en Argentina.',
  },
]

export interface WellbeingStory {
  id: string
  tag: 'testimonio' | 'dieta'
  title: string
  author: string
  text: string
}

export const WELLBEING_STORIES: WellbeingStory[] = [
  {
    id: 's1',
    tag: 'testimonio',
    title: 'Aprendí a pedir ayuda',
    author: 'Marta, paciente de cáncer de mama',
    text: 'Durante mucho tiempo sentí que tenía que estar bien para no preocupar a mi familia. El día que empecé a decir "hoy no puedo" todo se hizo un poco más liviano. No lo solucionó, pero lo hizo más llevadero.',
  },
  {
    id: 's2',
    tag: 'testimonio',
    title: 'Los días malos también pasan',
    author: 'Julián, acompañante',
    text: 'Acompañar no es tener todas las respuestas. A veces es solo quedarse sentado al lado, en silencio, mientras el día pesado transcurre.',
  },
  {
    id: 'd1',
    tag: 'dieta',
    title: 'Comidas suaves para días de náuseas',
    author: 'Compartido por la comunidad',
    text: 'Muchas personas cuentan que en los días de más náuseas les resultó más fácil comer porciones chicas y frecuentes, alimentos fríos o tibios (no calientes) y evitar olores fuertes. Esto no reemplaza la indicación de tu nutricionista oncológico: cada tratamiento y cada cuerpo son distintos.',
  },
  {
    id: 'd2',
    tag: 'dieta',
    title: 'Hidratación como hábito',
    author: 'Compartido por la comunidad',
    text: 'Tener una botella cerca durante todo el día ayudó a varias personas a cumplir con la hidratación indicada, sobre todo en los días posteriores a la sesión. Consultá siempre la cantidad recomendada con tu equipo médico.',
  },
]
