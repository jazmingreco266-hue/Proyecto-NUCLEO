/**
 * Generador mínimo de archivos Excel (.xlsx) sin dependencias externas.
 *
 * Un .xlsx es un ZIP con archivos XML (formato Office Open XML, ECMA-376). Se usa el método
 * "store" (sin compresión), que Excel, LibreOffice y Google Sheets leen sin problema.
 * Soporta texto, números, montos, fechas, porcentajes y fórmulas (con su valor ya calculado).
 */
import { crc32 } from "node:zlib";

export type CellType = "text" | "number" | "money" | "date" | "percent";
export type Formula = { formula: string; value: number };
export type Cell = string | number | null | Formula;

export type Column = { header: string; type: CellType; width?: number };
export type Sheet = { name: string; columns: Column[]; rows: Cell[][]; totals?: Cell[] };

// ─────────────────────────── ZIP (método store) ───────────────────────────

export function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // Fecha fija (1/1/2026): el contenido no depende de la hora, y la fecha real va en el nombre del archivo.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(dosTime, 12);
    dir.writeUInt16LE(dosDate, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(f.data.length, 20);
    dir.writeUInt32LE(f.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += 30 + name.length + f.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

// ─────────────────────────── XML ───────────────────────────

export function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "") // caracteres no válidos en XML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Fecha AAAA-MM-DD → número de serie de Excel (días desde el 30/12/1899). */
export function excelDate(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const STYLE: Record<CellType | "header" | "total", number> = { text: 0, header: 1, money: 2, date: 3, percent: 4, number: 5, total: 6 };

function cellXml(ref: string, value: Cell, type: CellType, bold = false): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    const s = bold ? STYLE.total : STYLE[type];
    return `<c r="${ref}" s="${s}"><f>${xmlText(value.formula)}</f><v>${value.value}</v></c>`;
  }
  if (type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return `<c r="${ref}" s="${STYLE.date}"><v>${excelDate(value)}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const v = type === "percent" ? value / 100 : value;
    return `<c r="${ref}" s="${bold ? STYLE.total : STYLE[type === "text" ? "number" : type]}"><v>${v}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr" s="${bold ? STYLE.header : STYLE.text}"><is><t xml:space="preserve">${xmlText(String(value))}</t></is></c>`;
}

function sheetXml(sh: Sheet): string {
  const lastCol = colName(sh.columns.length - 1);
  const rows: string[] = [];
  rows.push(`<row r="1">${sh.columns.map((c, i) => cellXml(`${colName(i)}1`, c.header, "text", true)).join("")}</row>`);
  sh.rows.forEach((r, ri) => {
    const n = ri + 2;
    rows.push(`<row r="${n}">${sh.columns.map((c, ci) => cellXml(`${colName(ci)}${n}`, r[ci] ?? null, c.type)).join("")}</row>`);
  });
  if (sh.totals) {
    const n = sh.rows.length + 2;
    rows.push(`<row r="${n}">${sh.columns.map((c, ci) => cellXml(`${colName(ci)}${n}`, sh.totals![ci] ?? null, c.type, true)).join("")}</row>`);
  }
  const cols = sh.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join("");
  const filter = sh.rows.length ? `<autoFilter ref="A1:${lastCol}${sh.rows.length + 1}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>${filter}</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F1"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Arma el libro. Los nombres de hoja se ajustan a las reglas de Excel (máx. 31 caracteres, sin : \ / ? * [ ]). */
export function buildXlsx(sheets: Sheet[]): Buffer {
  const names = sheets.map((s, i) => (s.name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || `Hoja${i + 1}`));
  const files = [
    {
      name: "[Content_Types].xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${xmlText(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", xml: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, xml: sheetXml(s) })),
  ];
  return zip(files.map((f) => ({ name: f.name, data: Buffer.from(f.xml, "utf8") })));
}

export { colName };
