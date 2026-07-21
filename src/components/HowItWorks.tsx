import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/Eyebrow";

const steps = [
  {
    number: "01",
    title: "Completás un formulario",
    description:
      "Nos contás cómo funciona tu empresa hoy: áreas, tareas y lo que más te complica.",
  },
  {
    number: "02",
    title: "Nos enviás tus documentos, archivos y audios",
    description:
      "Todo lo que ya existe, tal como está: planillas, PDFs, notas de voz, capturas.",
  },
  {
    number: "03",
    title: "Procesamos todo con IA (Claude) y lo ordenamos",
    description:
      "Analizamos, estructuramos y redactamos manuales y procesos claros a partir de ese material.",
  },
  {
    number: "04",
    title: "Recibís un portal privado listo para usar",
    description:
      "Un lugar único donde tu equipo encuentra manuales, procesos, plantillas y calculadoras.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-paper py-20 sm:py-28">
      <Container>
        <Reveal>
          <Eyebrow>Cómo funciona</Eyebrow>
          <h2 className="mt-5 max-w-[28ch] text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            De tu desorden a un sistema, en cuatro pasos.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 0.08} className="h-full">
              <div className="flex h-full flex-col gap-4 bg-paper p-7">
                <span className="text-[15px] font-semibold text-accent">
                  {step.number}
                </span>
                <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
