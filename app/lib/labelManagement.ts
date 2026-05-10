export type LabelTemplateType = "single" | "pallet" | "section";

export interface PrinterProfile {
  id: string;
  name: string;
  printerIp: string;
  default: boolean;
}

const PRINTER_PROFILES_KEY = "warehouse_printer_profiles";

const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "printer-default",
    name: "Default Zebra Printer",
    printerIp: "192.168.1.100",
    default: true,
  },
];

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
      return `^XA\n^BY3,2,100\n^FO50,50^BCN,100,Y,N,N^FD${value}^FS\n^FO50,180^A0N,40,40^FD${value}^FS\n^XZ`;
    }
  }
}
