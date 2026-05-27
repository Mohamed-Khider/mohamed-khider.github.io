export interface WarehouseDataBackup {
  app: "warehouse-label-system";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

const STORAGE_PREFIX = "warehouse_";

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const stored = localStorage.getItem(key);
  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export function listWarehouseStorageKeys(): string[] {
  if (typeof window === "undefined") return [];

  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX) || key === "packing_records") {
      keys.push(key);
    }
  }
  return keys.sort();
}

export function exportWarehouseBackup(): WarehouseDataBackup {
  const data: Record<string, unknown> = {};

  listWarehouseStorageKeys().forEach((key) => {
    data[key] = readJson<unknown>(key, null);
  });

  return {
    app: "warehouse-label-system",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function importWarehouseBackup(backup: WarehouseDataBackup): void {
  if (backup.app !== "warehouse-label-system" || backup.version !== 1) {
    throw new Error("Backup file is not compatible with this warehouse system.");
  }

  Object.entries(backup.data).forEach(([key, value]) => {
    if (!key.startsWith(STORAGE_PREFIX) && key !== "packing_records") {
      return;
    }
    writeJson(key, value);
  });
}
