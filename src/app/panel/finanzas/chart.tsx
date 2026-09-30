/**
 * Ventas y gastos por mes (barras agrupadas) con el resultado como línea, en un solo eje (misma moneda).
 * SVG generado en el servidor. Colores: primeras tres posiciones de la paleta categórica validada
 * (azul, naranja, aqua). El aqua tiene contraste < 3:1 sobre blanco: por eso hay leyenda,
 * etiqueta del último resultado y una tabla con los mismos datos.
 */
type Point = { month: string; sales: number; expenses: number; profit: number };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const W = 760;
const H = 300;
const PAD = { top: 18, right: 64, bottom: 34, left: 70 };

function niceStep(range: number, target = 4) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

export function SalesChart({ data, currency }: { data: Point[]; currency: string }) {
  const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
  const full = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 });
  const hi = Math.max(1, ...data.flatMap((d) => [d.sales, d.expenses, d.profit]));
  const lo = Math.min(0, ...data.map((d) => d.profit));
  const step = niceStep(hi - lo);
  const yMax = Math.ceil(hi / step) * step;
  const yMin = Math.floor(lo / step) * step;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const band = plotW / data.length;
  const barW = Math.min(18, band * 0.3);
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);

  /** Barra con extremo de datos redondeado (4px) y base recta. */
  const bar = (x: number, v: number) => {
    const top = y(v);
    const base = y(0);
    const h = base - top;
    if (h <= 0.5) return "";
    const r = Math.min(4, h, barW / 2);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const line = data.map((d, i) => `${i ? "L" : "M"}${cx(i)},${y(d.profit)}`).join(" ");
  const last = data[data.length - 1];
  const label = (m: string, i: number) => {
    const [yy, mm] = m.split("-");
    const name = MONTHS[Number(mm) - 1];
    return i === 0 || mm === "01" ? `${name} ${yy!.slice(2)}` : name;
  };

  return (
    <figure className="chart">
      <ul className="legend" aria-label="Referencias">
        <li>
          <span className="key key-sales" aria-hidden="true" /> Ventas
        </li>
        <li>
          <span className="key key-expenses" aria-hidden="true" /> Gastos
        </li>
        <li>
          <span className="key key-profit" aria-hidden="true" /> Resultado (ventas − gastos)
        </li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ventas, gastos y resultado de los últimos ${data.length} meses en ${currency}. El detalle está en la tabla de abajo.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={PAD.left - 10} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {compact.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.month}>
            <path d={bar(cx(i) - barW - 1, d.sales)} className="m-sales" />
            <path d={bar(cx(i) + 1, d.expenses)} className="m-expenses" />
            <text x={cx(i)} y={H - PAD.bottom + 20} className="tick" textAnchor="middle">
              {label(d.month, i)}
            </text>
          </g>
        ))}
        <path d={line} className="m-profit" />
        {data.map((d, i) => (
          <circle key={d.month} cx={cx(i)} cy={y(d.profit)} r={4} className="m-profit-dot" />
        ))}
        {last && (
          <text x={cx(data.length - 1) + 10} y={y(last.profit)} className="end-label" dominantBaseline="middle">
            {compact.format(last.profit)}
          </text>
        )}
        {/* Zonas de lectura más grandes que las marcas, con el detalle del mes al pasar el mouse. */}
        {data.map((d, i) => (
          <rect key={d.month} x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} className="hit">
            <title>{`${label(d.month, 0)} · Ventas ${full.format(d.sales)} · Gastos ${full.format(d.expenses)} · Resultado ${full.format(d.profit)}`}</title>
          </rect>
        ))}
      </svg>
      <details className="disclose">
        <summary className="faint">Ver los datos en tabla</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Ventas</th>
                <th scope="col">Gastos</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month}>
                  <td>{label(d.month, 0)}</td>
                  <td className="num">{full.format(d.sales)}</td>
                  <td className="num">{full.format(d.expenses)}</td>
                  <td className="num">{full.format(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
