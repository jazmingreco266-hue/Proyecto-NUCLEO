"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    // TODO: conectar a un endpoint real (por ejemplo /api/contacto o un
    // proveedor externo como Resend / Formspree). Por ahora simulamos el
    // envío para poder validar el flujo de UI de punta a punta.
    await new Promise((resolve) => setTimeout(resolve, 900));

    setStatus("success");
  }

  return (
    <section id="contacto" className="bg-ink py-20 sm:py-28">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.08em] text-accent">
              Empecemos
            </p>
            <h2 className="max-w-[22ch] text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-paper">
              Contanos de tu empresa y te armamos un plan.
            </h2>
            <p className="mt-6 max-w-[40ch] text-[16px] leading-relaxed text-paper/60">
              Respondemos en menos de 24 horas hábiles. Sin compromiso, sin
              letra chica.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            {status === "success" ? (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-paper/15 bg-paper/5 p-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-accent" strokeWidth={1.5} />
                <h3 className="text-[20px] font-semibold text-paper">
                  ¡Listo, recibimos tu mensaje!
                </h3>
                <p className="max-w-[36ch] text-[15px] leading-relaxed text-paper/60">
                  Te vamos a escribir a la brevedad para coordinar los
                  próximos pasos.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nombre" htmlFor="nombre">
                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      required
                      autoComplete="name"
                      className={inputClasses}
                    />
                  </Field>
                  <Field label="Empresa" htmlFor="empresa">
                    <input
                      id="empresa"
                      name="empresa"
                      type="text"
                      required
                      autoComplete="organization"
                      className={inputClasses}
                    />
                  </Field>
                </div>

                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={inputClasses}
                  />
                </Field>

                <Field label="Contame de tu empresa" htmlFor="mensaje">
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    required
                    rows={4}
                    placeholder="A qué se dedica, cuántas personas trabajan, qué te gustaría ordenar primero..."
                    className={`${inputClasses} resize-none`}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3.5 text-[15px] font-medium text-paper transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "loading" ? "Enviando..." : "Enviar"}
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

const inputClasses =
  "w-full rounded-lg border border-paper/15 bg-paper/5 px-4 py-3 text-[15px] text-paper placeholder:text-paper/35 outline-none transition-colors focus:border-accent";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-paper/70">
        {label}
      </label>
      {children}
    </div>
  );
}
