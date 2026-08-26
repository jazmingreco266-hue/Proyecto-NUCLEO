import { HeartHandshake, Target, Eye, Heart } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'

export default function Nosotros() {
  return (
    <div>
      <PageHeader
        title="Quiénes somos"
        subtitle="La historia detrás de Núcleo"
        icon={<HeartHandshake size={22} />}
      />

      <Card className="mb-6 border-l-2 border-l-lavender-600 bg-lavender-50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lavender-600">
            <Heart size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">Una carta, antes que nada</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              Núcleo nació de una necesidad muy concreta: acompañar a mi mamá durante su
              tratamiento oncológico sin perder de vista ni un turno, ni una toma de medicación,
              ni cómo se sintió cada día. Entre las carpetas con estudios, los grupos de WhatsApp
              familiares y el cansancio de las noches largas, faltaba un lugar donde todo eso
              conviviera de forma simple y cálida.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">
              Pero esta app no es solo para nosotras. Está pensada para cualquier persona que
              esté atravesando un proceso oncológico y para cualquier familia que quiera
              acompañar de cerca, sin invadir, sin agregar carga y sin reemplazar jamás a un
              equipo médico. Si te sirve aunque sea un poco, ya cumplió su propósito.
            </p>
            <p className="mt-4 text-sm font-semibold text-lavender-600">Con cariño, el equipo de Núcleo.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="bg-lavender-600 text-white">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
            <Target size={20} />
          </div>
          <h3 className="font-display text-lg font-semibold">Misión</h3>
          <p className="mt-2 text-sm text-white/90">
            Organizar el tratamiento oncológico, registrar su evolución, facilitar la
            comunicación con el equipo médico y reducir la carga mental de pacientes y familias,
            sin diagnosticar ni reemplazar jamás una indicación profesional.
          </p>
        </Card>
        <Card>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
            <Eye size={20} />
          </div>
          <h3 className="font-display text-lg font-semibold text-ink-900">Visión</h3>
          <p className="mt-2 text-sm text-ink-700">
            Que ninguna persona atraviese un proceso oncológico sintiéndose sola o desorganizada,
            y que ninguna familia tenga que inventar, de cero, la forma de acompañar.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-display text-lg font-semibold text-ink-900">Nuestros principios</h3>
        <ul className="mt-3 space-y-2 text-sm text-ink-700">
          <li>• Núcleo organiza y acompaña. No diagnostica, no interpreta estudios y no sugiere cambios de tratamiento.</li>
          <li>• Toda indicación de emergencia o plan de acción la carga el equipo médico, nunca la app.</li>
          <li>• Tus datos de salud son tuyos: se pueden exportar o eliminar por completo cuando quieras.</li>
          <li>• Nada de publicidad basada en datos de salud, ni venta de información a terceros.</li>
        </ul>
      </Card>
    </div>
  )
}
