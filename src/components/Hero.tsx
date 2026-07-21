"use client";

import { motion } from "framer-motion";
import { Container } from "./ui/Container";
import { Button } from "./ui/Button";
import { PortalMockup } from "./PortalMockup";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-paper pt-20 pb-24 sm:pt-28 sm:pb-32">
      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6 text-[14px] font-medium uppercase tracking-[0.08em] text-accent"
            >
              El sistema operativo de tu empresa
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink"
            >
              Transformamos tus audios, planillas y documentos desordenados en
              un sistema profesional para manejar tu empresa.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-[46ch] text-[18px] leading-relaxed text-ink-soft"
            >
              Ordenamos el conocimiento que hoy vive en tu cabeza y en
              archivos sueltos, y te lo devolvemos en un portal privado con
              manuales, procesos, plantillas y calculadoras listos para usar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-col gap-4 sm:flex-row"
            >
              <Button href="#contacto" variant="primary">
                Quiero mi sistema
              </Button>
              <Button href="#como-funciona" variant="secondary">
                Ver cómo funciona
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <PortalMockup />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
