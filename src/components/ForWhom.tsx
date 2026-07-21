import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";
import { Eyebrow } from "./ui/Eyebrow";

const traits = [
  "Crecieron rápido y el orden no acompañó ese crecimiento.",
  "Dependen de una o dos personas que \"saben cómo se hace todo\".",
  "Pierden tiempo y plata por procesos que no están escritos en ningún lado.",
];

export function ForWhom() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>Para quién es</Eyebrow>
            <h2 className="mt-5 text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
              PyMEs que crecieron sin sistema y dependen de una sola persona.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="flex flex-col gap-6">
              {traits.map((trait) => (
                <li key={trait} className="flex gap-4 border-b border-line pb-6 last:border-b-0 last:pb-0">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <p className="text-[17px] leading-relaxed text-ink">{trait}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
