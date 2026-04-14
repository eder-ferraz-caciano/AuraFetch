export type ElementKind = 'text' | 'barcode' | 'qrcode' | 'line' | 'config' | 'unknown';

export interface ParsedElement {
  kind: ElementKind;
  raw: string;
  x: number | null;
  y: number | null;
  data: string | null;
  fontHeight: number | null;
  fontWidth: number | null;
  fontId: number | null;
  rotation: number | null;
  barcodeHeight: number | null;
  barcodeModuleWidth: number | null;
  barcodeType: string | null;
  qrSize: number | null;
  lineLength: number | null;
  lineThickness: number | null;
  configKey: string | null;
  configValue: string | null;
  index: number;
}

function emptyElement(index: number, raw: string): ParsedElement {
  return {
    kind: 'unknown', raw, index,
    x: null, y: null, data: null,
    fontHeight: null, fontWidth: null, fontId: null, rotation: null,
    barcodeHeight: null, barcodeModuleWidth: null, barcodeType: null,
    qrSize: null, lineLength: null, lineThickness: null,
    configKey: null, configValue: null,
  };
}

// ─── ZPL Parsing ────────────────────────────────────────────

export function parseZplElements(code: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  let idx = 0;

  // Extract body between ^XA and ^XZ
  const xaMatch = code.match(/\^XA\s*/);
  const xzMatch = code.match(/\s*\^XZ/);
  if (!xaMatch || !xzMatch) {
    // Can't parse, return single unknown
    if (code.trim()) {
      elements.push({ ...emptyElement(0, code.trim()), kind: 'unknown' });
    }
    return elements;
  }

  const bodyStart = (xaMatch.index ?? 0) + xaMatch[0].length;
  const bodyEnd = xzMatch.index ?? code.length;
  const body = code.substring(bodyStart, bodyEnd);

  // Split by ^FS into segments, then parse each
  // But we need to handle config commands (^PW, ^LL) that don't have ^FS
  const segments: string[] = [];
  let remaining = body;

  // First extract config commands that appear before any ^FO
  const configRe = /\^(PW|LL)(\d+)/g;
  let cfgMatch: RegExpExecArray | null;
  const configPositions: { start: number; end: number; raw: string }[] = [];

  while ((cfgMatch = configRe.exec(remaining)) !== null) {
    configPositions.push({
      start: cfgMatch.index,
      end: cfgMatch.index + cfgMatch[0].length,
      raw: cfgMatch[0],
    });
  }

  for (const cp of configPositions) {
    const el = emptyElement(idx++, cp.raw);
    el.kind = 'config';
    el.configKey = cp.raw.match(/\^(PW|LL)/)?.[1] ?? null;
    el.configValue = cp.raw.match(/\^(?:PW|LL)(\d+)/)?.[1] ?? null;
    elements.push(el);
  }

  // Now extract ^FO...^FS blocks (may span multiple lines)
  const foFsRe = /\^FO[\s\S]*?\^FS/g;
  let foMatch: RegExpExecArray | null;

  while ((foMatch = foFsRe.exec(body)) !== null) {
    segments.push(foMatch[0]);
  }

  for (const seg of segments) {
    const el = emptyElement(idx++, seg);

    // Extract position ^FO{x},{y}
    const posMatch = seg.match(/\^FO(\d+),(\d+)/);
    if (posMatch) {
      el.x = parseInt(posMatch[1]);
      el.y = parseInt(posMatch[2]);
    }

    // Try to identify element type
    if (/\^BQN/.test(seg)) {
      // QR Code
      el.kind = 'qrcode';
      const qrSizeMatch = seg.match(/\^BQN,\d+,(\d+)/);
      if (qrSizeMatch) el.qrSize = parseInt(qrSizeMatch[1]);
      const qrDataMatch = seg.match(/\^FDQA,(.+?)\^FS/s);
      if (qrDataMatch) el.data = qrDataMatch[1];
    } else if (/\^B[C0-9]/.test(seg) && /\^BY/.test(seg)) {
      // Barcode
      el.kind = 'barcode';
      const byMatch = seg.match(/\^BY(\d+),(\d+),(\d+)/);
      if (byMatch) {
        el.barcodeModuleWidth = parseInt(byMatch[1]);
        el.barcodeHeight = parseInt(byMatch[3]);
      }
      const bcTypeMatch = seg.match(/\^(BC[A-Z])/);
      if (bcTypeMatch) el.barcodeType = bcTypeMatch[1];
      const bcHeightMatch = seg.match(/\^BCN,(\d+)/);
      if (bcHeightMatch) el.barcodeHeight = parseInt(bcHeightMatch[1]);
      const fdMatch = seg.match(/\^FD(.+?)\^FS/s);
      if (fdMatch) el.data = fdMatch[1];
    } else if (/\^GB/.test(seg)) {
      // Line/separator
      el.kind = 'line';
      const gbMatch = seg.match(/\^GB(\d+),(\d+),(\d+)/);
      if (gbMatch) {
        el.lineLength = parseInt(gbMatch[1]);
        el.lineThickness = parseInt(gbMatch[3]);
      }
    } else if (/\^A\d/.test(seg) && /\^FD/.test(seg)) {
      // Text
      el.kind = 'text';
      const fontMatch = seg.match(/\^A0N,(\d+),(\d+)/);
      if (fontMatch) {
        el.fontHeight = parseInt(fontMatch[1]);
        el.fontWidth = parseInt(fontMatch[2]);
      }
      const fdMatch = seg.match(/\^FD(.+?)\^FS/s);
      if (fdMatch) el.data = fdMatch[1];
    }

    elements.push(el);
  }

  return elements;
}

// ─── DPL Parsing ────────────────────────────────────────────

export function parseDplElements(code: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const lines = code.split('\n');
  let idx = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const el = emptyElement(idx++, raw);

    // STX start marker
    if (trimmed === '\x02L' || trimmed === '\x02l') {
      el.kind = 'config';
      el.configKey = 'STX';
      el.configValue = trimmed;
      elements.push(el);
      continue;
    }

    // End marker
    if (trimmed === 'E') {
      el.kind = 'config';
      el.configKey = 'ETX';
      el.configValue = 'E';
      elements.push(el);
      continue;
    }

    // Density
    if (/^D\d+$/.test(trimmed)) {
      el.kind = 'config';
      el.configKey = 'D';
      el.configValue = trimmed.substring(1);
      elements.push(el);
      continue;
    }

    // Height
    if (/^H\d+$/.test(trimmed)) {
      el.kind = 'config';
      el.configKey = 'H';
      el.configValue = trimmed.substring(1);
      elements.push(el);
      continue;
    }

    // Width (inches)
    if (/^c\d+$/.test(trimmed)) {
      el.kind = 'config';
      el.configKey = 'c';
      el.configValue = trimmed.substring(1);
      elements.push(el);
      continue;
    }

    // Text: 1A[font:1][rot:1][x:4][y:4][h:3][data]
    const textMatch = trimmed.match(/^1A(\d)(\d)(\d{4})(\d{4})(\d{3})(.+)$/);
    if (textMatch) {
      el.kind = 'text';
      el.fontId = parseInt(textMatch[1]);
      el.rotation = parseInt(textMatch[2]);
      el.x = parseInt(textMatch[3]);
      el.y = parseInt(textMatch[4]);
      el.fontHeight = parseInt(textMatch[5]);
      el.data = textMatch[6];
      elements.push(el);
      continue;
    }

    // Line: LO[x:4][y:4][len:4][wid:2-4]
    const lineMatch = trimmed.match(/^LO(\d{4})(\d{4})(\d{4})(\d{2,4})$/);
    if (lineMatch) {
      el.kind = 'line';
      el.x = parseInt(lineMatch[1]);
      el.y = parseInt(lineMatch[2]);
      el.lineLength = parseInt(lineMatch[3]);
      el.lineThickness = parseInt(lineMatch[4]);
      elements.push(el);
      continue;
    }

    // Barcode: 1B[rot:1][type:2][x:4][y:4][h:3][narrow:1][data]
    const bcMatch = trimmed.match(/^1B(\d)(\d{2})(\d{4})(\d{4})(\d{3})(\d)(.+)$/);
    if (bcMatch) {
      el.kind = 'barcode';
      el.rotation = parseInt(bcMatch[1]);
      el.barcodeType = bcMatch[2];
      el.x = parseInt(bcMatch[3]);
      el.y = parseInt(bcMatch[4]);
      el.barcodeHeight = parseInt(bcMatch[5]);
      el.barcodeModuleWidth = parseInt(bcMatch[6]);
      el.data = bcMatch[7];
      elements.push(el);
      continue;
    }

    // Unknown
    elements.push(el);
  }

  return elements;
}

// ─── Code Regeneration ─────────────────────────────────────

const pad = (n: number, len = 4) => String(n).padStart(len, '0');

export function elementToZpl(el: ParsedElement): string {
  switch (el.kind) {
    case 'text':
      return `^FO${el.x ?? 0},${el.y ?? 0}^A0N,${el.fontHeight ?? 28},${el.fontWidth ?? 28}^FD${el.data ?? ''}^FS`;
    case 'line':
      return `^FO${el.x ?? 0},${el.y ?? 0}^GB${el.lineLength ?? 100},${el.lineThickness ?? 2},${el.lineThickness ?? 2}^FS`;
    case 'barcode':
      return `^FO${el.x ?? 0},${el.y ?? 0}\n^BY${el.barcodeModuleWidth ?? 2},3,${el.barcodeHeight ?? 80}\n^BCN,${el.barcodeHeight ?? 80},Y,N,N\n^FD${el.data ?? ''}^FS`;
    case 'qrcode':
      return `^FO${el.x ?? 0},${el.y ?? 0}\n^BQN,2,${el.qrSize ?? 4}\n^FDQA,${el.data ?? ''}^FS`;
    case 'config':
      if (el.configKey === 'PW') return `^PW${el.configValue ?? ''}`;
      if (el.configKey === 'LL') return `^LL${el.configValue ?? ''}`;
      return el.raw;
    default:
      return el.raw;
  }
}

export function elementToDpl(el: ParsedElement): string {
  switch (el.kind) {
    case 'text':
      return `1A${el.fontId ?? 1}${el.rotation ?? 0}${pad(el.x ?? 0)}${pad(el.y ?? 0)}${pad(el.fontHeight ?? 28, 3)}${el.data ?? ''}`;
    case 'line':
      return `LO${pad(el.x ?? 0)}${pad(el.y ?? 0)}${pad(el.lineLength ?? 100)}${pad(el.lineThickness ?? 2, 3)}`;
    case 'barcode':
      return `1B${el.rotation ?? 1}${el.barcodeType ?? '02'}${pad(el.x ?? 0)}${pad(el.y ?? 0)}${pad(el.barcodeHeight ?? 80, 3)}${el.barcodeModuleWidth ?? 0}${el.data ?? ''}`;
    case 'config':
      if (el.configKey === 'STX') return '\x02L';
      if (el.configKey === 'ETX') return 'E';
      if (el.configKey === 'D') return `D${el.configValue ?? '11'}`;
      if (el.configKey === 'H') return `H${el.configValue ?? '0406'}`;
      if (el.configKey === 'c') return `c${el.configValue ?? '4'}`;
      return el.raw;
    default:
      return el.raw;
  }
}

export function reassembleZpl(elements: ParsedElement[]): string {
  const configs = elements.filter(e => e.kind === 'config').map(e => elementToZpl(e));
  const fields = elements.filter(e => e.kind !== 'config').map(e => elementToZpl(e));
  return `^XA\n${configs.join('\n')}\n${fields.join('\n')}\n^XZ`;
}

export function reassembleDpl(elements: ParsedElement[]): string {
  return elements.map(e => elementToDpl(e)).join('\n');
}

// ─── Display Helpers ────────────────────────────────────────

const KIND_LABELS: Record<ElementKind, string> = {
  text: 'Texto',
  barcode: 'Barcode',
  qrcode: 'QR Code',
  line: 'Separador',
  config: 'Config',
  unknown: 'Desconhecido',
};

const CONFIG_LABELS: Record<string, string> = {
  PW: 'Largura etiqueta',
  LL: 'Altura etiqueta',
  H: 'Altura etiqueta',
  c: 'Largura (pol)',
  D: 'Densidade',
  STX: 'Inicio',
  ETX: 'Fim',
};

export function getElementLabel(el: ParsedElement): string {
  if (el.kind === 'config') {
    const label = CONFIG_LABELS[el.configKey ?? ''] ?? 'Config';
    if (el.configKey === 'STX' || el.configKey === 'ETX') return label;
    return `${label}: ${el.configValue ?? ''}`;
  }
  const kindLabel = KIND_LABELS[el.kind];
  const preview = el.data ? (el.data.length > 25 ? el.data.substring(0, 25) + '...' : el.data) : '';
  return preview ? `${kindLabel}: ${preview}` : kindLabel;
}

export function isEditableConfig(el: ParsedElement): boolean {
  return el.kind === 'config' && el.configKey !== 'STX' && el.configKey !== 'ETX';
}
