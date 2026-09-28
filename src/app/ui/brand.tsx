/** Marca en texto, igual que en la web de Núcleo. */
export function Wordmark({ sub = "Panel operativo" }: { sub?: string }) {
  return (
    <span className="wordmark">
      Núcleo
      {sub && <small>{sub}</small>}
    </span>
  );
}
