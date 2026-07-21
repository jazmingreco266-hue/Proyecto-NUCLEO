import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/Eyebrow";

const testimonials = [
  {
    quote:
      "Antes, si yo me enfermaba un día, la operación se frenaba. Hoy cualquiera del equipo abre el portal y sabe exactamente qué hacer.",
    name: "Marina Sosa",
    role: "Dueña, Distribuidora Sosa Hnos.",
  },
  {
    quote:
      "Ordenaron en tres semanas lo que nosotros veníamos posponiendo hace dos años. Los manuales son claros y los usa todo el equipo, no solo yo.",
    name: "Ezequiel Farías",
    role: "Gerente General, Construcciones Farías",
  },
  {
    quote:
      "La calculadora de cotizaciones sola ya justificó la inversión. Cotizamos en minutos lo que antes nos llevaba media tarde.",
    name: "Julieta Beltrán",
    role: "Socia, Estudio Beltrán & Asociados",
  },
];

const logos = ["Grupo Aldea", "Vértice SRL", "Construcciones Farías", "Estudio Beltrán", "Sosa Hnos."];

export function SocialProof() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <Reveal>
          <Eyebrow>Confían en Núcleo</Eyebrow>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col justify-between gap-8 rounded-2xl border border-line p-8">
                <blockquote className="text-[16px] leading-relaxed text-ink">
                  “{t.quote}”
                </blockquote>
                <figcaption>
                  <div className="text-[15px] font-semibold text-ink">{t.name}</div>
                  <div className="text-[14px] text-ink-soft">{t.role}</div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-16 border-t border-line pt-10">
            <p className="mb-6 text-center text-[13px] uppercase tracking-[0.08em] text-ink-soft">
              Empresas que ya sistematizaron su operación
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {logos.map((logo) => (
                <span
                  key={logo}
                  className="text-[16px] font-semibold tracking-[-0.01em] text-ink-soft/70"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
