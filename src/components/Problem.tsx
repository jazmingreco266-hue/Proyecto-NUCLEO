import { Reveal } from "./ui/Reveal";
import { Container } from "./ui/Container";

export function Problem() {
  return (
    <section className="border-y border-line bg-offwhite py-20 sm:py-28">
      <Container>
        <Reveal>
          <p className="max-w-[62ch] text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.3] tracking-[-0.02em] text-ink">
            Tu empresa creció, pero el conocimiento sigue viviendo en tu
            cabeza, en audios de WhatsApp y en planillas sueltas. Si vos no
            estás, nadie sabe bien cómo se hacen las cosas.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
