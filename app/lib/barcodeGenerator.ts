/**
 * Comprehensive barcode and label generation service
 * Supports flexible label sizing, range generation, and ZPL output
 */

export type LabelSize = "2.5x1" | "4x6";

export interface LabelDimensions {
  width: number; // in dots (1/203 inch)
  height: number; // in dots
  label: string;
}

export interface BarcodeItem {
  code: string;
  label: string;
}

export interface GenerationOptions {
  labelSize: LabelSize;
  startX?: number;
  startY?: number;
}

/**
 * Label size presets optimized for Zebra printers
 * Dimensions in dots (1/203 inch DPI)
 */
const LABEL_SIZES: Record<LabelSize, LabelDimensions> = {
  "2.5x1": {
    width: 508, // 2.5 inches * 203 DPI
    height: 203, // 1 inch * 203 DPI
    label: '2.5" x 1" (Small)',
  },
  "4x6": {
    width: 812, // 4 inches * 203 DPI
    height: 1218, // 6 inches * 203 DPI
    label: '4" x 6" (Standard)',
  },
};

export function getLabelDimensions(size: LabelSize): LabelDimensions {
  return LABEL_SIZES[size] || LABEL_SIZES["4x6"];
}

/**
 * Generate barcode items from a range specification
 * Examples:
 * - "RML-C01-S01-L1A" -> single barcode
 * - "1-5" with prefix -> RML-C01-S01-L1A, RML-C01-S01-L2A, etc.
 * - "BIN-S-001,10" -> BIN-S-001 to BIN-S-010
 */
export function generateBarcodeRange(
  spec: string,
  prefix: string = "",
  levelSuffix: string = ""
): BarcodeItem[] {
  const items: BarcodeItem[] = [];

  // Clean input
  const input = spec.trim();

  // Check if it's a range (e.g., "1-5" or "001-010")
  const rangeMatch = input.match(/^(\d+)\s*-\s*(\d+)$/);

  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);

    // Preserve leading zeros if input uses them
    const padLength = rangeMatch[1].length;

    for (let i = start; i <= end; i++) {
      const num =
        padLength > 1
          ? i.toString().padStart(padLength, "0")
          : i.toString();

      let code = prefix;

      if (prefix) {
        code += `-${num}`;

        if (levelSuffix) {
          code += `-${levelSuffix}`;
        }
      } else {
        code = num;
      }

      const trimmedCode = code.trim();

      items.push({
        code: trimmedCode,
        label: trimmedCode,
      });
    }

    return items;
  }

  // Check if it's comma-separated list or multiline
  const codes = input
    .split(/[,\n]/)
    .map((c) => c.trim())
    .filter(Boolean);

  codes.forEach((code) => {
    items.push({
      code,
      label: code,
    });
  });

  return items;
}

/**
 * Calculate barcode width in dots for CODE128 format
 * Formula: (charCount * 11 + 35) * moduleWidth
 */
function calculateBarcodeWidth(
  value: string,
  moduleWidth: number
): number {
  const charCount = value.length;
  const totalModules = charCount * 11 + 35;

  return totalModules * moduleWidth;
}

/**
 * Generate ZPL for a single barcode on small label (2.5x1)
 */
function generateSmallLabelZpl(
  code: string,
  index: number = 0
): string {
  const dims = LABEL_SIZES["2.5x1"];
  const moduleWidth = 2;
  const barcodeHeight = 80;
  const textHeight = 16;
  const textY = barcodeHeight + 15;

  return `^XA
^PW${dims.width}
^LL${dims.height}
^LH0,0
^FO30,10
^BY${moduleWidth},2,${barcodeHeight}
^BCN,${barcodeHeight},N,N,N
^FD${code}^FS
^FO30,${textY}
^A0N,${textHeight},${textHeight}
^FD${code}^FS
^XZ`;
}

/**
 * Generate ZPL for multiple barcodes on standard label (4x6)
 * Optimized to fit multiple barcodes per page
 */
function generateStandardLabelZpl(
  codes: BarcodeItem[]
): string {
  const dims = LABEL_SIZES["4x6"];
  const itemsPerPage = 4; // 4 barcodes per 4x6 label
  const moduleWidth = 3;
  const barcodeHeight = 100;
  const textHeight = 24;

  let zpl = `^XA\n^PW${dims.width}\n^LL${dims.height}\n^LH0,0\n`;

  // Calculate layout for 2 columns
  const spacing = dims.height / (itemsPerPage / 2);
  const colWidth = dims.width / 2;

  codes.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);

    const xPos = col * colWidth + 20;
    const yPos = row * spacing + 20;

    zpl += `^FO${xPos},${yPos}\n`;
    zpl += `^BY${moduleWidth},2,${barcodeHeight}\n`;
    zpl += `^BCN,${barcodeHeight},N,N,N\n`;
    zpl += `^FD${item.code}^FS\n`;

    zpl += `^FO${xPos},${yPos + barcodeHeight + 5}\n`;
    zpl += `^A0N,${textHeight},${textHeight}\n`;
    zpl += `^FD${item.code}^FS\n`;
  });

  zpl += `^XZ`;

  return zpl;
}

/**
 * Generate individual ZPL for each barcode (for small labels)
 */
export function generateIndividualZplPerBarcode(
  codes: BarcodeItem[]
): string[] {
  return codes.map((item, idx) =>
    generateSmallLabelZpl(item.code, idx)
  );
}

/**
 * Generate combined ZPL based on label size
 */
export function generateZpl(
  codes: BarcodeItem[],
  options: GenerationOptions
): string {
  if (codes.length === 0) {
    return "";
  }

  if (options.labelSize === "2.5x1") {
    // For small labels, combine all barcodes in one ZPL with page breaks
    let zpl = "";

    codes.forEach((item, idx) => {
      if (idx > 0) {
        zpl += "\n";
      }

      zpl += generateSmallLabelZpl(item.code, idx);
    });

    return zpl;
  }

  // For standard labels, organize multiple barcodes per page
  return generateStandardLabelZpl(codes);
}

/**
 * Validate barcode code format
 */
export function validateBarcodeCode(code: string): {
  valid: boolean;
  error?: string;
} {
  if (!code || code.trim().length === 0) {
    return {
      valid: false,
      error: "Code cannot be empty",
    };
  }

  if (code.length > 100) {
    return {
      valid: false,
      error: "Code is too long (max 100 characters)",
    };
  }

  // Allow alphanumeric and common symbols
  if (!/^[a-zA-Z0-9\-_.]+$/.test(code)) {
    return {
      valid: false,
      error:
        "Code contains invalid characters (use letters, numbers, -, _, .)",
    };
  }

  return { valid: true };
}

/**
 * Parse location components from barcode string
 * Format: WAREHOUSE-ZONE-SECTION-LEVEL or similar
 */
export function parseLocationComponents(code: string): {
  warehouse?: string;
  zone?: string;
  section?: string;
  level?: string;
} {
  const parts = code.split("-");

  return {
    warehouse: parts[0],
    zone: parts[1],
    section: parts[2],
    level: parts[3],
  };
}

/**
 * Build location barcode from components
 */
export function buildLocationBarcode(
  warehouse: string,
  zone: string,
  section: string,
  level?: string
): string {
  let code = `${warehouse}-${zone}-${section}`;

  if (level) {
    code += `-${level}`;
  }

  return code;
}
