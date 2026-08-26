/**
 * Nu, la mascota de Núcleo. Un personaje simple y cálido (no un blob
 * decorativo genérico) que aparece en estados vacíos y momentos de
 * bienvenida para que la app se sienta acompañada, sin perder la estética
 * prolija del resto de la interfaz.
 */
export function Mascot({
  className = '',
  pose = 'wave',
}: {
  className?: string
  pose?: 'wave' | 'peek' | 'sit'
}) {
  return (
    <svg viewBox="0 0 120 130" className={className} aria-hidden>
      <defs>
        <linearGradient id="mascot-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-lavender-500)" />
          <stop offset="1" stopColor="var(--color-peach-500)" />
        </linearGradient>
      </defs>

      {/* sombra */}
      <ellipse cx="60" cy="118" rx="26" ry="6" fill="var(--color-ink-900)" opacity="0.08" />

      {/* piernitas */}
      <ellipse cx="46" cy="104" rx="8" ry="10" fill="var(--color-lavender-300)" />
      <ellipse cx="74" cy="104" rx="8" ry="10" fill="var(--color-lavender-300)" />

      {/* brazo quieto */}
      <ellipse cx="18" cy="66" rx="9" ry="15" fill="url(#mascot-body)" transform="rotate(-18 18 66)" />

      {/* cuerpo */}
      <rect x="18" y="18" width="84" height="82" rx="38" fill="url(#mascot-body)" />

      {/* brazo que saluda */}
      {pose === 'wave' && (
        <ellipse cx="103" cy="46" rx="9" ry="16" fill="url(#mascot-body)" transform="rotate(35 103 46)" />
      )}
      {pose !== 'wave' && (
        <ellipse cx="102" cy="66" rx="9" ry="15" fill="url(#mascot-body)" transform="rotate(18 102 66)" />
      )}

      {/* cachetes */}
      <circle cx="38" cy="66" r="7" fill="var(--color-peach-300)" opacity="0.55" />
      <circle cx="82" cy="66" r="7" fill="var(--color-peach-300)" opacity="0.55" />

      {/* ojos */}
      <circle cx="46" cy="56" r="5" fill="white" />
      <circle cx="74" cy="56" r="5" fill="white" />
      <circle cx="47" cy="57" r="2.6" fill="var(--color-ink-900)" />
      <circle cx="75" cy="57" r="2.6" fill="var(--color-ink-900)" />

      {/* sonrisa */}
      <path
        d="M48 70 Q60 79 72 70"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* chispita */}
      <path
        d="M100 16 L103 23 L110 26 L103 29 L100 36 L97 29 L90 26 L97 23 Z"
        fill="var(--color-peach-500)"
      />
    </svg>
  )
}
