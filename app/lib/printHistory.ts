import { readJson, removeStorageItem, writeJson } from "./storage";

export type PrintHistoryType = "pallet" | "section" | "other";

export interface PrintHistoryEntry {
  id: string;
  type: PrintHistoryType;
  title: string;
  location: string;
  codes: string[];
  printerIp?: string;
  action: "printed" | "sent";
  user: string;
  createdAt: string;
}

const HISTORY_KEY = "warehouse_print_history";

export function initializePrintHistory(): void {
  if (typeof window === "undefined") return;

  const existing = localStorage.getItem(HISTORY_KEY);
  if (!existing) {
    writeJson(HISTORY_KEY, []);
  }
}

export function getPrintHistory(): PrintHistoryEntry[] {
  return readJson<PrintHistoryEntry[]>(HISTORY_KEY, []);
}

export function addPrintHistory(entry: Omit<PrintHistoryEntry, "id" | "createdAt">): PrintHistoryEntry {
  const history = getPrintHistory();
  const newEntry: PrintHistoryEntry = {
    ...entry,
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  const updatedHistory = [newEntry, ...history].slice(0, 50);
  writeJson(HISTORY_KEY, updatedHistory);
  return newEntry;
}

export function clearPrintHistory(): void {
  removeStorageItem(HISTORY_KEY);
}

export function getPrintHistoryByType(type: PrintHistoryType): PrintHistoryEntry[] {
  return getPrintHistory().filter((entry) => entry.type === type);
}
