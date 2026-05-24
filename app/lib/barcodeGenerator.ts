/**
 * Comprehensive barcode and label generation service
 * Supports flexible label sizing, range generation, and ZPL output
 */

export type LabelSize = "2x1" | "4x6";

export interface LabelDimensions {
  width: number; // in dots (1/203 inch)
  height: number; // in dots
  pageHeight: number; // in dots for long continuous or grouped pages
  label: string;
}

export type LabelTemplate = "pallet" | "shipment" | "amazon";

export interface BarcodeItem {
  code: string;
  label?: string;
  description?: string;
}

export interface GenerationOptions {
  labelSize: LabelSize;
  labelTemplate?: LabelTemplate;
  description?: string;
  startX?: number;
  startY?: number;
}

/**
 * Label size presets optimized for Zebra printers
 * Dimensions in dots (1/203 inch DPI)
 */
const LABEL_SIZES: Record<LabelSize, LabelDimensions> = {
  "2x1": {
    width: 406, // 2 inches * 203 DPI
    height: 203, // 1 inch * 203 DPI
    pageHeight: 203, // single-label page by default
    label: "2\" x 1\" (Small)",
  },
  "4x6": {
    width: 812, // 4 inches * 203 DPI
    height: 1218, // 6 inches * 203 DPI
    pageHeight: 1218, // one 4x6 page
    label: "4\" x 6\" (Standard)",
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

    for (let i = start; i <= end; i++) {
      const num = start.toString().length === 3 ? i.toString().padStart(3, "0") : i.toString();
      let code = prefix;

      if (prefix) {
        code += `-${num}`;
        if (levelSuffix) {
          code += `-${levelSuffix}`;
        }
      } else {
        code = num;
      }

      items.push({
        code: code.trim(),
        label: code.trim(),
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
      code: code,
      label: code,
    });
  });

  return items;
}

/**
 * Calculate barcode width in dots for CODE128 format
 * Formula: (charCount * 11 + 35) * moduleWidth
 */
function calculateBarcodeWidth(value: string, moduleWidth: number): number {
  const charCount = value.length;
  const totalModules = charCount * 11 + 35;
  return totalModules * moduleWidth;
}

/**
 * Generate ZPL for a single barcode on small label (2" x 1")
 */
function chooseModuleWidth(value: string, maxWidthDots: number, paddingDots = 20): number {
  const baseModules = value.length * 11 + 35;
  for (let mw = 1; mw <= 10; mw++) {
    if (baseModules * mw + paddingDots <= maxWidthDots) return mw;
  }
  return 1;
}

function escapeZplText(value: string): string {
  return value.replace(/([\\^~])/g, "\\$1");
}

function generateSmallLabelZpl(item: BarcodeItem, labelTemplate: LabelTemplate = "shipment"): string {
  const dims = LABEL_SIZES["2x1"];
  const barcodeHeight = 100;
  const textHeight = 20;
  const description = item.description || item.label || item.code;
  const escapedDescription = escapeZplText(description || "");
  const alignMode = labelTemplate === "amazon" ? "L" : "C";

  let zpl = `^XA\n^PW${dims.width}\n^LL${dims.height}\n^LH40,20\n`;
  zpl += `^FO30,10\n`;
  zpl += `^BY3,2,100\n`;
  zpl += `^BCN,80,Y,N,N,A\n`;
  zpl += `^FD${escapeZplText(item.code)}^FS\n`;

  if (escapedDescription) {
    zpl += `^FO0,150\n`;
    zpl += `^A0N,${textHeight},${textHeight}\n`;
    zpl += `^FB${dims.width},3,0,${alignMode}\n`;
    zpl += `^FD${escapedDescription}^FS\n`;
  }

  zpl += `^XZ`;
  return zpl;
}

function generatePalletLabelPageZpl(codes: BarcodeItem[]): string {
  const dims = LABEL_SIZES["4x6"];
  const barcodeHeight = 100;
  const positions = [60, 260, 460, 660, 860, 1060];

  let zpl = `^XA\n^PW${dims.width}\n^LL${dims.height}\n^LH0,0\n`;
  zpl += `^BY5,2,${barcodeHeight}\n`;

  codes.forEach((item, idx) => {
    const yPos = positions[idx];
    zpl += `^FO100,${yPos}\n`;
    zpl += `^BCN,${barcodeHeight},Y,N,N\n`;
    zpl += `^FD${escapeZplText(item.code)}^FS\n`;
  });

  zpl += `^XZ`;
  return zpl;
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

  const labelTemplate: LabelTemplate = options.labelTemplate
    ? options.labelTemplate
    : options.labelSize === "4x6"
    ? "pallet"
    : "shipment";

  if (labelTemplate === "pallet") {
    const pages: string[] = [];
    const itemsPerPage = 6;
    for (let i = 0; i < codes.length; i += itemsPerPage) {
      pages.push(generatePalletLabelPageZpl(codes.slice(i, i + itemsPerPage)));
    }
    return pages.join("\n");
  }

  const pages: string[] = [];
  codes.forEach((item) => {
    pages.push(generateSmallLabelZpl(item, labelTemplate));
  });
  return pages.join("\n");
}

/**
 * Validate barcode code format
 */
export function validateBarcodeCode(code: string): {
  valid: boolean;
  error?: string;
} {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: "Code cannot be empty" };
  }

  if (code.length > 100) {
    return { valid: false, error: "Code is too long (max 100 characters)" };
  }

  // Allow alphanumeric and common symbols
  if (!/^[a-zA-Z0-9\-_.]+$/.test(code)) {
    return {
      valid: false,
      error: "Code contains invalid characters (use letters, numbers, -, _, .)",
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
