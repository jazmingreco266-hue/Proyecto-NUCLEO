import { Container } from "./ui/Container";

const links = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#que-entregas", label: "Qué entregás" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#contacto", label: "Contacto" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper py-14">
      <Container className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Núcleo
          </p>
          <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-ink-soft">
            El sistema operativo de tu empresa.
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-8 gap-y-3"
          aria-label="Enlaces del sitio"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="text-[14px] text-ink-soft">
          <a href="mailto:hola@nucleo.com.ar" className="hover:text-ink">
            hola@nucleo.com.ar
          </a>
          <p className="mt-2">© {year} Núcleo. Todos los derechos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
