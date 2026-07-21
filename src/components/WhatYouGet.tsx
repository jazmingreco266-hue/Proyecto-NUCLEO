import { BookOpen, Workflow, FileStack, Calculator } from "lucide-react";
import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/Eyebrow";

const features = [
  {
    icon: BookOpen,
    title: "Manuales",
    description: "Todo el saber-hacer de tu empresa documentado.",
  },
  {
    icon: Workflow,
    title: "Procesos",
    description: "Paso a paso claro para cada tarea.",
  },
  {
    icon: FileStack,
    title: "Plantillas",
    description: "Documentos listos para reutilizar.",
  },
  {
    icon: Calculator,
    title: "Calculadoras",
    description: "Herramientas para decidir y cotizar más rápido.",
  },
];

export function WhatYouGet() {
  return (
    <section id="que-entregas" className="bg-offwhite py-20 sm:py-28">
      <Container>
        <Reveal>
          <Eyebrow>Qué recibís</Eyebrow>
          <h2 className="mt-5 max-w-[32ch] text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Un portal privado con todo lo que tu equipo necesita.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-paper p-7">
                <Icon className="h-6 w-6 text-accent" strokeWidth={1.5} />
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
                  {title}
                </h3>
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  {description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
