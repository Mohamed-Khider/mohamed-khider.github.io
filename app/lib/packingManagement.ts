/**
 * Packing Management System
 * Handles order packing, box tracking, and packing list generation
 */

export type BoxIdType = "number" | "generated";
export type PackType = "pack_unit" | "pack_l1";
import * as XLSX from "xlsx";

export interface PackingItem {
  sku: string;
  name: string;
  packType: PackType;
  quantity: number;
  uom: string;

  // 🔥 NEW
  packedQty?: number; // runtime tracking

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
  contents: BoxContent[];
  createdAt: string;
  completedAt?: string;
  totalItems: number;
}

export interface PackingOrder {
  id: string;
  orderId: string;
  clientName: string;
  boxIdType: BoxIdType;
  items: PackingItem[];
  boxes: Box[];
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
 * Parse packing list from Excel or CSV format
 * Expected columns (case-insensitive): SKU, Name, PackType, Quantity, UOM
 */
export async function parsePackingListExcel(file: File): Promise<PackingItem[]> {
  try {
    let rows: any[] = [];

    // 🔥 Detect file type
    if (file.name.endsWith(".xlsx") || file.type.includes("spreadsheet")) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { header: 1 });
      
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
      // CSV/TXT parsing
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());

      if (lines.length < 2) {
        throw new Error("CSV must have header row and at least one data row");
      }

      // Parse header
      const headerLine = lines[0];
      const delimiter = headerLine.includes("\t") ? "\t" : ",";
      const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v) => v.trim());
        const row: any = {};

        headers.forEach((header, idx) => {
          row[header] = values[idx] || "";
        });

        rows.push(row);
      }
    }

    // Map column names (handle variations)
    const items: PackingItem[] = [];

    for (const row of rows) {
      // Find columns (case-insensitive)
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

    if (items.length === 0) {
      throw new Error(
        "No valid items found in file. Check format: SKU, Name, PackType, Quantity, UOM"
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

  items.forEach(item => {
    if (item.packType === "pack_l1") {
      for (let i = 0; i < item.quantity; i++) {
        const boxNumber = boxes.length + 1;

        const boxId =
          boxIdType === "generated"
            ? generateBoxId(clientName, boxNumber)
            : `Box ${boxNumber}`;

        boxes.push({
          boxId,
          contents: [
            {
              itemSku: item.sku,
              itemName: item.name,
              packType: item.packType,
              quantityPacked: 1,
              quantityRequired: item.quantity,
              uom: item.uom,
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          totalItems: 1,
        });
      }

      // mark fully packed
      item.packedQty = item.quantity;
    }
  });

  return {
    id: `packing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    orderId,
    clientName,
    boxIdType,
    items,
    boxes, // 🔥 pre-filled with PACK_L1
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
    records.push(record);
    localStorage.setItem("packing_records", JSON.stringify(records));
  } catch (error) {
    console.error("Error saving packing record:", error);
  }
}

/**
 * Get all packing records from local storage
 */
export function getPackingRecords(): PackingRecord[] {
  try {
    const data = localStorage.getItem("packing_records");
    return data ? JSON.parse(data) : [];
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
    localStorage.setItem("packing_records", JSON.stringify(filtered));
  } catch (error) {
    console.error("Error deleting packing record:", error);
  }
}
