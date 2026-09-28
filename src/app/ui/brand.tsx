export function BrandMark() {
  // Una línea con tres estaciones: el recorrido de un prospecto.
  return (
    <svg className="brand-mark" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="11.5" width="20" height="3" rx="1.5" fill="var(--line)" />
      <circle cx="5" cy="13" r="3.5" fill="var(--g-prospeccion)" />
      <circle cx="13" cy="13" r="3.5" fill="var(--g-venta)" />
      <circle cx="21" cy="13" r="4.5" fill="var(--bg)" stroke="var(--signal)" strokeWidth="3" />
    </svg>
  );
}
