import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/Eyebrow";

export function About() {
  return (
    <section id="nosotros" className="border-y border-line bg-offwhite py-20 sm:py-28">
      <Container>
        <Reveal>
          <Eyebrow>Nosotros</Eyebrow>
        </Reveal>

        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal delay={0.05}>
            <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-paper p-8">
              <h3 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-accent">
                Visión
              </h3>
              <p className="text-[19px] leading-relaxed tracking-[-0.01em] text-ink">
                Un mundo donde cualquier PyME opere con la claridad, los
                procesos y las herramientas de una empresa de primer nivel,
                sin depender de la memoria de una sola persona.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-paper p-8">
              <h3 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-accent">
                Misión
              </h3>
              <p className="text-[19px] leading-relaxed tracking-[-0.01em] text-ink">
                Convertimos el conocimiento disperso de cada empresa —audios,
                planillas y documentos sueltos— en un sistema central,
                documentado y listo para crecer, accesible desde un portal
                privado.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
