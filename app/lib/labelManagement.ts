export type LabelTemplateType = "single" | "pallet" | "section";
export type LabelSizeType =
  | "1x3"
  | "1.125x1.25"
  | "1.1875x1"
  | "1.2x0.85"
  | "1.25x1"
  | "2x1"
  | "2.2x0.5"
  | "2.25x1.25"
  | "2.25x2.5"
  | "2.25x0.5"
  | "2.25x2"
  | "3x3"
  | "3x2"
  | "4x1.5"
  | "4x2"
  | "4x2.5"
  | "4x3"
  | "4x5"
  | "4x6";

export interface LabelSize {
  id: LabelSizeType;
  label: string;
  width: number;
  height: number;
}

export type PrinterConnectionMethod = "wifi" | "usb" | "bluetooth";

export interface PrinterProfile {
  id: string;
  name: string;
  connectionMethod: PrinterConnectionMethod;
  address: string;
  default: boolean;
}

const PRINTER_PROFILES_KEY = "warehouse_printer_profiles";

const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "printer-default",
    name: "Default Zebra Printer",
    connectionMethod: "wifi",
    address: "192.168.1.100",
    default: true,
  },
];

export const LABEL_SIZES: LabelSize[] = [
  { id: "1x3", label: '1" x 3"', width: 609, height: 203 },
  { id: "1.125x1.25", label: '1.125" x 1.25"', width: 229, height: 254 },
  { id: "1.1875x1", label: '1.1875" x 1"', width: 241, height: 203 },
  { id: "1.2x0.85", label: '1.2" x 0.85"', width: 244, height: 173 },
  { id: "1.25x1", label: '1.25" x 1"', width: 254, height: 203 },
  { id: "2x1", label: '2" x 1"', width: 406, height: 203 },
  { id: "2.2x0.5", label: '2.2" x 0.5"', width: 447, height: 102 },
  { id: "2.25x1.25", label: '2.25" x 1.25"', width: 457, height: 254 },
  { id: "2.25x2.5", label: '2.25" x 2.5"', width: 457, height: 508 },
  { id: "2.25x0.5", label: '2.25" x 0.5"', width: 457, height: 102 },
  { id: "2.25x2", label: '2.25" x 2"', width: 457, height: 406 },
  { id: "3x3", label: '3" x 3"', width: 609, height: 609 },
  { id: "3x2", label: '3" x 2"', width: 609, height: 406 },
  { id: "4x1.5", label: '4" x 1.5"', width: 812, height: 305 },
  { id: "4x2", label: '4" x 2"', width: 812, height: 406 },
  { id: "4x2.5", label: '4" x 2.5"', width: 812, height: 508 },
  { id: "4x3", label: '4" x 3"', width: 812, height: 609 },
  { id: "4x5", label: '4" x 5"', width: 812, height: 1015 },
  { id: "4x6", label: '4" x 6"', width: 812, height: 1218 },
];

function getSizeById(sizeId: LabelSizeType): LabelSize {
  return LABEL_SIZES.find((size) => size.id === sizeId) ?? LABEL_SIZES[0];
}

function buildSingleLabelZpl(value: string, sizeId: LabelSizeType): string {
  const size = getSizeById(sizeId);

  const moduleWidth = size.width > 500 ? 3 : 2;
  const barcodeHeight = Math.max(80, Math.min(140, Math.floor(size.height * 0.35)));
  const textHeight = Math.max(16, Math.min(40, Math.floor(size.height * 0.18)));
  const barcodeWidth = calculateBarcodeWidth(value, moduleWidth);
  const startX = Math.max(0, Math.floor((size.width - barcodeWidth) / 2));

  const barcodeY = 20;
  const textY = barcodeY + barcodeHeight + 10;

  return `^XA
^PW${size.width}
^LL${size.height}
^LH0,0

^FO${startX},${barcodeY}
^BY${moduleWidth},2,${barcodeHeight}
^FB${size.width},1,0,C,0
^BCN,${barcodeHeight},N,N,N
^FD${value}
^FS

^FO0,${textY}
^A0N,${textHeight},${textHeight}
^FB${size.width},1,0,C,0
^FD${value}
^FS

^XZ`;
}

function calculateBarcodeWidth(value: string, moduleWidth: number) {
  const charCount = value.length;

  const totalModules = charCount * 11 + 35; // Code128 formula

  return totalModules * moduleWidth;
}

function getProfilesFromStorage(): PrinterProfile[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(PRINTER_PROFILES_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveProfiles(profiles: PrinterProfile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRINTER_PROFILES_KEY, JSON.stringify(profiles));
}

export function initializePrinterProfiles(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(PRINTER_PROFILES_KEY)) {
    saveProfiles(DEFAULT_PRINTER_PROFILES);
  }
}

export function getPrinterProfiles(): PrinterProfile[] {
  return getProfilesFromStorage();
}

export function getDefaultPrinterProfile(): PrinterProfile | null {
  const profiles = getPrinterProfiles();
  return profiles.find((profile) => profile.default) || null;
}

export function getPrinterProfileById(profileId: string): PrinterProfile | null {
  const profiles = getPrinterProfiles();
  return profiles.find((profile) => profile.id === profileId) || null;
}

export function addPrinterProfile(profile: Omit<PrinterProfile, "id">): PrinterProfile {
  const profiles = getPrinterProfiles();
  const newProfile: PrinterProfile = {
    id: `printer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...profile,
  };
  if (newProfile.default) {
    profiles.forEach((item) => (item.default = false));
  }
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}


export function updatePrinterProfile(profileId: string, updates: Partial<Omit<PrinterProfile, "id">>): boolean {
  const profiles = getPrinterProfiles();
  const index = profiles.findIndex((profile) => profile.id === profileId);
  if (index === -1) return false;
  const updatedProfile = { ...profiles[index], ...updates };

  if (updates.default) {
    profiles.forEach((item) => (item.default = false));
  }

  profiles[index] = updatedProfile;
  saveProfiles(profiles);
  return true;
}

// Layout calculation for Zebra printer (8" = 1624 dots wide at 203 DPI)
const ZEBRA_PAGE_WIDTH = 1624; // 8 inches
const ZEBRA_PAGE_HEIGHT = 1218; // 6 inches (standard height for labels)
const LABEL_MARGIN = 0; // Margin between labels

export interface LabelLayoutInfo {
  labelsPerRow: number;
  labelsPerPage: number;
  pageWidthDots: number;
  pageHeightDots: number;
  labelWidthDots: number;
  labelHeightDots: number;
}

export function calculateLabelLayout(sizeId: LabelSizeType): LabelLayoutInfo {
  const size = getSizeById(sizeId);
  
  // Calculate how many labels fit per row
  const labelsPerRow = Math.max(1, Math.floor(ZEBRA_PAGE_WIDTH / (size.width + LABEL_MARGIN)));
  
  // For small labels (narrow), fit multiple per page
  // For large labels (wide), minimize per page
  let pageHeight = ZEBRA_PAGE_HEIGHT;
  let labelsPerPage = 1;
  
  if (size.width < 609) {
    // Small labels (< 3"): can fit multiple per page
    // Calculate how many rows fit
    const rowsPerPage = Math.max(1, Math.floor(pageHeight / (size.height + LABEL_MARGIN)));
    labelsPerPage = labelsPerRow * rowsPerPage;
  } else {
    // Large labels (>= 3"): typically 1-2 per page
    labelsPerPage = labelsPerRow;
    // Adjust page height to fit labels better
    pageHeight = (labelsPerPage * size.height) + (LABEL_MARGIN * Math.max(0, labelsPerPage - 1));
  }
  
  return {
    labelsPerRow,
    labelsPerPage,
    pageWidthDots: ZEBRA_PAGE_WIDTH,
    pageHeightDots: pageHeight,
    labelWidthDots: size.width,
    labelHeightDots: size.height,
  };
}

export function buildZpl(template: LabelTemplateType, data: Record<string, string>): string {
  switch (template) {
    case "pallet": {
      const palletCode = data.palletCode ?? "PALLET-000";
      return `^XA\n^FO30,30^A0N,40,40^FD${palletCode}^FS\n^FO30,90^BY3,3,100^BCN,100,Y,N,N^FD${palletCode}^FS\n^XZ`;
    }
    case "section": {
      const sectionCode = data.sectionCode ?? "SECTION-001";
      return `^XA\n^FO30,30^A0N,40,40^FD${sectionCode}^FS\n^FO30,90^BY3,3,100^BCN,100,Y,N,N^FD${sectionCode}^FS\n^XZ`;
    }
    case "single":
    default: {
      const value = data.value ?? "ITEM-000";
      const size = (data.size as LabelSizeType) ?? "1x3";
      return buildSingleLabelZpl(value, size);
    }
  }
}
