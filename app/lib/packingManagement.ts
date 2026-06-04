/**
 * Packing Management System
 * Handles order packing, box tracking, and packing list generation
 */

import * as XLSX from "xlsx";
import { readJson, writeJson } from "./storage";

export type BoxIdType = "number" | "generated";
export type PackType = "pack_unit" | "pack_l1";
export type PackingListFormat = "logiwa" | "omnifull" | "auto";

export interface PackingItem {
  sku: string;
  name: string;
  packType: PackType;
  quantity: number;
  uom: string;

  // 🔥 NEW
  packedQty?: number; // runtime tracking
  itemStatus?: "packed" | "master_box" | "backed_elsewhere"; // Status: packed in box, master box (not packed), or backed elsewhere

  lotBatch?: string;
  expiryDate?: string;
  location?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export interface BoxContent {
  itemSku: string;
  itemName: string;
  packType: PackType;
  quantityPacked: number;
  quantityRequired: number;
  uom: string;
  timestamp: string;
}

export interface Box {
  boxId: string; // e.g., "LB-001" or "Box 1"
  customName?: string; // user-editable name
  contents: BoxContent[];
  createdAt: string;
  completedAt?: string;
  totalItems: number;
  palletId?: string; // assigned pallet
}

export interface Pallet {
  palletId: string; // e.g., "PALLET-001"
  boxIds: string[]; // array of box IDs in this pallet
  createdAt: string;
  totalBoxes: number;
  totalItems: number;
}

export interface PackingOrder {
  id: string;
  orderId: string;
  clientName: string;
  boxIdType: BoxIdType;
  items: PackingItem[];
  boxes: Box[];
  pallets?: Pallet[]; // array of pallets
  createdAt: string;
  completedAt?: string;
  status: "in-progress" | "completed";
}

export interface PackingRecord {
  orderId: string;
  clientName: string;
  packingData: PackingOrder;
  savedAt: string;
}

/**
 * Generate box ID based on client name and order
 * Format: First 2 letters of client + serial number (e.g., "LB-001")
 */
export function generateBoxId(clientName: string, boxNumber: number): string {
  const prefix = clientName
    .trim()
    .substring(0, 2)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (!prefix) return `BOX-${String(boxNumber).padStart(3, "0")}`;

  return `${prefix}-${String(boxNumber).padStart(3, "0")}`;
}

/**
 * Detect packing list format from headers
 */
export function detectPackingListFormat(headers: string[]): PackingListFormat {
  const headerLower = headers.map(h => h.toLowerCase());
  
  // OmniFull format indicators
  if (headerLower.includes("*seller_sku_code") || headerLower.includes("*order_number")) {
    return "omnifull";
  }
  
  // Logiwa format indicators
  if (headerLower.includes("reference_code") || headerLower.includes("logiwa_id")) {
    return "logiwa";
  }
  
  // Default generic format
  return "auto";
}

/**
 * Parse OmniFull format (Boutiqaat CSV export)
 * Expected columns: *seller_sku_code, *quantity, barcode, etc.
 */
function parseOmnifullFormat(rows: any[]): PackingItem[] {
  const skuMap = new Map<string, PackingItem>();

  for (const row of rows) {
    const getSafeValue = (keys: string[]) => {
      for (const key of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase() === key.toLowerCase() && row[rowKey]) {
            return row[rowKey];
          }
        }
      }
      return "";
    };

    const sku = getSafeValue(["seller_sku_code", "seller_sku", "sku", "*seller_sku_code"]);
    const quantity = Number(getSafeValue(["quantity", "*quantity", "qty"]));
    const barcode = getSafeValue(["barcode", "product_code"]);

    if (!sku || !quantity || isNaN(quantity)) continue;

    const key = sku.toString().trim();
    if (skuMap.has(key)) {
      const existing = skuMap.get(key)!;
      existing.quantity += Math.max(1, Math.floor(quantity));
    } else {
      skuMap.set(key, {
        sku: key,
        name: barcode || key,
        packType: "pack_unit",
        quantity: Math.max(1, Math.floor(quantity)),
        uom: "PCS",
        packedQty: 0,
      });
    }
  }

  return Array.from(skuMap.values());
}

/**
 * Parse Logiwa format (Inventory management system export)
 * Expected columns: reference_code, product_name, quantity, etc.
 */
function parseLogiwaFormat(rows: any[]): PackingItem[] {
  const items: PackingItem[] = [];

  for (const row of rows) {
    const getSafeValue = (keys: string[]) => {
      for (const key of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase() === key.toLowerCase() && row[rowKey]) {
            return row[rowKey];
          }
        }
      }
      return "";
    };

    const sku = getSafeValue(["reference_code", "product_code", "sku"]);
    const name = getSafeValue(["product_name", "name", "description"]);
    const quantity = Number(getSafeValue(["quantity", "qty", "quantity_required"]));
    const packTypeRaw = getSafeValue(["pack_type", "packing_type", "packtype"]) || "unit";

    if (!sku || !name || !quantity || isNaN(quantity)) continue;

    items.push({
      sku: sku.toString().trim(),
      name: name.toString().trim(),
      packType: packTypeRaw.toLowerCase().includes("l1") ? "pack_l1" : "pack_unit",
      quantity: Math.max(1, Math.floor(quantity)),
      uom: "PCS",
      packedQty: 0,
    });
  }

  return items;
}

/**
 * Parse generic packing list format
 */
function parseGenericFormat(rows: any[]): PackingItem[] {
  const items: PackingItem[] = [];

  for (const row of rows) {
    const getSafeValue = (keys: string[]) => {
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase() === lowerKey && row[rowKey]) {
            return row[rowKey];
          }
        }
      }
      return "";
    };

    const sku = getSafeValue(["sku", "SKU", "product_id", "product id"]);
    const name = getSafeValue(["name", "product_name", "product name", "description"]);
    const packTypeRaw = getSafeValue(["packtype", "pack_type", "pack type", "packing type"]);
    const quantity = Number(getSafeValue(["quantity", "qty", "qnty", "quantity_required"]));
    const uom = getSafeValue(["uom", "unit", "unit_of_measure"]) || "PCS";

    if (!sku || !name || !quantity || isNaN(quantity)) {
      console.warn(`Skipping invalid row:`, row);
      continue;
    }

    items.push({
      sku: sku.toString().trim(),
      name: name.toString().trim(),
      packType: packTypeRaw.toLowerCase().includes("l1") ? "pack_l1" : "pack_unit",
      quantity: Math.max(1, Math.floor(quantity)),
      uom: uom.toString().trim() || "PCS",
      packedQty: 0,
    });
  }

  return items;
}

/**
 * Parse packing list from Excel or CSV format
 * Supports: Generic format, OmniFull (Boutiqaat), Logiwa
 */
export async function parsePackingListExcel(file: File): Promise<PackingItem[]> {
  try {
    let rows: any[] = [];

    if (file.name.endsWith(".xlsx") || file.type.includes("spreadsheet")) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      
      if (!workbook.Sheets || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file is empty or invalid");
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "", blankrows: false });

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error("No data found in Excel file");
      }

      rows = jsonData;
    } else {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());

      if (lines.length < 2) {
        throw new Error("CSV must have header row and at least one data row");
      }

      const headerLine = lines[0];
      const delimiter = headerLine.includes("\t") ? "\t" : ",";
      const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v) => v.trim());
        const row: any = {};

        headers.forEach((header, idx) => {
          row[header] = values[idx] || "";
        });

        rows.push(row);
      }
    }

    // Detect format and parse accordingly
    const headers = Object.keys(rows[0] || {});
    const format = detectPackingListFormat(headers);
    let items: PackingItem[] = [];

    if (format === "omnifull") {
      items = parseOmnifullFormat(rows);
    } else if (format === "logiwa") {
      items = parseLogiwaFormat(rows);
    } else {
      items = parseGenericFormat(rows);
    }

    if (items.length === 0) {
      throw new Error(
        "No valid items found in file. Supported formats: Generic (SKU, Name, Quantity), OmniFull, Logiwa"
      );
    }

    return items;
  } catch (error: any) {
    console.error("Parse error:", error);
    throw new Error(
      error.message || "Failed to parse file. Use format: SKU,Name,PackType,Quantity,UOM"
    );
  }
}

/**
 * Legacy function - no longer used, kept for compatibility
 */
function parseSheetData(sheetXml: string, stringsXml: string): PackingItem[] {
  return [];
}

/**
 * Create a new packing order
 */
export function createPackingOrder(
  orderId: string,
  clientName: string,
  items: PackingItem[],
  boxIdType: BoxIdType = "generated"
): PackingOrder {

  const boxes: Box[] = [];
  const pallets: Pallet[] = [];

  return {
    id: `packing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    orderId,
    clientName,
    boxIdType,
    items,
    boxes,
    pallets,
    createdAt: new Date().toISOString(),
    status: "in-progress",
  };
}

/**
 * Add a box to the packing order
 */
export function addBox(order: PackingOrder): Box {
  const boxNumber = order.boxes.length + 1;
  const boxId =
    order.boxIdType === "generated"
      ? generateBoxId(order.clientName, boxNumber)
      : `Box ${boxNumber}`;

  return {
    boxId,
    contents: [],
    createdAt: new Date().toISOString(),
    totalItems: 0,
  };
}

/**
 * Add item to box
 */
export function addItemToBox(
  box: Box,
  item: PackingItem,
  quantityPacked: number
): BoxContent {

  const currentPacked = item.packedQty || 0;

  if (currentPacked + quantityPacked > item.quantity) {
    throw new Error(`Quantity exceeded for ${item.sku}`);
  }

  const content: BoxContent = {
    itemSku: item.sku,
    itemName: item.name,
    packType: item.packType,
    quantityPacked,
    quantityRequired: item.quantity,
    uom: item.uom,
    timestamp: new Date().toISOString(),
  };

  item.packedQty = currentPacked + quantityPacked;

  box.contents.push(content);
  box.totalItems += quantityPacked;

  return content;
}
/**
 * Validate if packing is complete
 */
export function validatePackingComplete(order: PackingOrder): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  for (const item of order.items) {
    let totalPacked = 0;

    for (const box of order.boxes) {
      totalPacked += box.contents
        .filter((c) => c.itemSku === item.sku)
        .reduce((sum, c) => sum + c.quantityPacked, 0);
    }

    if (totalPacked < item.quantity) {
      missing.push(
        `${item.name} (SKU: ${item.sku}) - packed ${totalPacked}/${item.quantity}`
      );
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Save packing record to local storage
 */
export function savePackingRecord(record: PackingRecord): void {
  try {
    const records = getPackingRecords();
    const filteredRecords = records.filter((item) => item.orderId !== record.orderId);
    writeJson("packing_records", [record, ...filteredRecords]);
  } catch (error) {
    console.error("Error saving packing record:", error);
  }
}

/**
 * Get all packing records from local storage
 */
export function getPackingRecords(): PackingRecord[] {
  try {
    return readJson<PackingRecord[]>("packing_records", []);
  } catch (error) {
    console.error("Error retrieving packing records:", error);
    return [];
  }
}

/**
 * Get specific packing record by order ID
 */
export function getPackingRecord(orderId: string): PackingRecord | null {
  const records = getPackingRecords();
  return records.find((r) => r.orderId === orderId) || null;
}

/**
 * Delete packing record
 */
export function deletePackingRecord(orderId: string): void {
  try {
    const records = getPackingRecords();
    const filtered = records.filter((r) => r.orderId !== orderId);
    writeJson("packing_records", filtered);
  } catch (error) {
    console.error("Error deleting packing record:", error);
  }
}

/**
 * Create a new pallet and add it to the order
 */
export function createPallet(order: PackingOrder, boxIds: string[] = []): Pallet {
  const palletNumber = (order.pallets?.length || 0) + 1;
  const palletId = `PALLET-${String(palletNumber).padStart(3, "0")}`;

  let totalItems = 0;
  for (const boxId of boxIds) {
    const box = order.boxes.find((b) => b.boxId === boxId);
    if (box) {
      totalItems += box.totalItems;
      box.palletId = palletId; // assign box to pallet
    }
  }

  const pallet: Pallet = {
    palletId,
    boxIds,
    createdAt: new Date().toISOString(),
    totalBoxes: boxIds.length,
    totalItems,
  };

  return pallet;
}

/**
 * Add a box to an existing pallet
 */
export function addBoxToPallet(
  order: PackingOrder,
  palletId: string,
  boxId: string
): Pallet | null {
  if (!order.pallets) {
    order.pallets = [];
  }

  const pallet = order.pallets.find((p) => p.palletId === palletId);
  if (!pallet) return null;

  if (!pallet.boxIds.includes(boxId)) {
    const box = order.boxes.find((b) => b.boxId === boxId);
    if (box) {
      // remove from old pallet if assigned
      if (box.palletId && box.palletId !== palletId) {
        const oldPallet = order.pallets.find((p) => p.palletId === box.palletId);
        if (oldPallet) {
          oldPallet.boxIds = oldPallet.boxIds.filter((id) => id !== boxId);
          oldPallet.totalBoxes = oldPallet.boxIds.length;
          oldPallet.totalItems -= box.totalItems;
        }
      }

      pallet.boxIds.push(boxId);
      pallet.totalBoxes = pallet.boxIds.length;
      pallet.totalItems += box.totalItems;
      box.palletId = palletId;
    }
  }

  return pallet;
}

/**
 * Remove a box from a pallet
 */
export function removeBoxFromPallet(
  order: PackingOrder,
  palletId: string,
  boxId: string
): void {
  if (!order.pallets) return;

  const pallet = order.pallets.find((p) => p.palletId === palletId);
  if (pallet) {
    const box = order.boxes.find((b) => b.boxId === boxId);
    if (box) {
      pallet.boxIds = pallet.boxIds.filter((id) => id !== boxId);
      pallet.totalBoxes = pallet.boxIds.length;
      pallet.totalItems -= box.totalItems;
      box.palletId = undefined;
    }
  }
}

/**
 * Rename a box
 */
export function renameBox(order: PackingOrder, boxId: string, newName: string): void {
  const box = order.boxes.find((b) => b.boxId === boxId);
  if (box) {
    box.customName = newName || undefined;
  }
}

/**
 * Get pallet summary statistics
 */
export function getPalletSummary(
  order: PackingOrder
): {
  totalPallets: number;
  boxesPerPallet: Record<string, number>;
  itemsPerPallet: Record<string, number>;
  unassignedBoxes: number;
} {
  if (!order.pallets) {
    order.pallets = [];
  }

  const boxesPerPallet: Record<string, number> = {};
  const itemsPerPallet: Record<string, number> = {};

  for (const pallet of order.pallets) {
    boxesPerPallet[pallet.palletId] = pallet.totalBoxes;
    itemsPerPallet[pallet.palletId] = pallet.totalItems;
  }

  const unassignedBoxes = order.boxes.filter((b) => !b.palletId).length;

  return {
    totalPallets: order.pallets.length,
    boxesPerPallet,
    itemsPerPallet,
    unassignedBoxes,
  };
}
