import { readJson, writeJson } from "./storage";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  locationId?: string;
  unit: string;
  updatedAt: string;
}

export interface InventoryReceipt {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  locationId?: string;
  unit: string;
  receivedAt: string;
}

export interface InventoryMovement {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  movedAt: string;
  user: string;
}

const INVENTORY_KEY = "warehouse_inventory_items";
const RECEIPTS_KEY = "warehouse_inventory_receipts";
const MOVEMENTS_KEY = "warehouse_inventory_movements";
const SHIPMENTS_KEY = "warehouse_inventory_shipments";
const ADJUSTMENTS_KEY = "warehouse_inventory_adjustments";

function getStoredData<T>(key: string): T[] {
  return readJson<T[]>(key, []);
}

function saveStoredData<T>(key: string, data: T[]): void {
  writeJson(key, data);
}

export function initializeInventory(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(INVENTORY_KEY)) {
    saveStoredData<InventoryItem>(INVENTORY_KEY, []);
  }
  if (!localStorage.getItem(RECEIPTS_KEY)) {
    saveStoredData<InventoryReceipt>(RECEIPTS_KEY, []);
  }
  if (!localStorage.getItem(MOVEMENTS_KEY)) {
    saveStoredData<InventoryMovement>(MOVEMENTS_KEY, []);
  }
  if (!localStorage.getItem(SHIPMENTS_KEY)) {
    saveStoredData<InventoryShipment>(SHIPMENTS_KEY, []);
  }
  if (!localStorage.getItem(ADJUSTMENTS_KEY)) {
    saveStoredData<InventoryAdjustment>(ADJUSTMENTS_KEY, []);
  }
}

export function getInventoryItems(): InventoryItem[] {
  return getStoredData<InventoryItem>(INVENTORY_KEY);
}

export function getInventoryItemById(itemId: string): InventoryItem | null {
  return getInventoryItems().find((item) => item.id === itemId) || null;
}

export function getInventoryItemsByLocation(locationId: string): InventoryItem[] {
  return getInventoryItems().filter((item) => item.locationId === locationId);
}

export function getReceiptHistory(): InventoryReceipt[] {
  return getStoredData<InventoryReceipt>(RECEIPTS_KEY);
}

export function getMovementHistory(): InventoryMovement[] {
  return getStoredData<InventoryMovement>(MOVEMENTS_KEY);
}

export interface StockSummary {
  sku: string;
  name: string;
  totalQuantity: number;
  unit: string;
  locations: Array<{ locationId?: string; quantity: number }>;
}

export function getStockSummary(): StockSummary[] {
  const items = getInventoryItems().filter((item) => item.quantity > 0);
  const summaryMap: Record<string, StockSummary> = {};

  items.forEach((item) => {
    const key = `${item.sku}-${item.unit}`;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        sku: item.sku,
        name: item.name,
        totalQuantity: 0,
        unit: item.unit,
        locations: [],
      };
    }

    summaryMap[key].totalQuantity += item.quantity;
    const existingLocation = summaryMap[key].locations.find((entry) => entry.locationId === item.locationId);
    if (existingLocation) {
      existingLocation.quantity += item.quantity;
    } else {
      summaryMap[key].locations.push({ locationId: item.locationId, quantity: item.quantity });
    }
  });

  return Object.values(summaryMap);
}

export function receiveInventory({
  sku,
  name,
  quantity,
  locationId,
  unit,
}: {
  sku: string;
  name: string;
  quantity: number;
  locationId?: string;
  unit: string;
}): InventoryItem {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const items = getInventoryItems();
  const match = items.find(
    (item) => item.sku.toLowerCase() === sku.toLowerCase() && item.locationId === locationId && item.unit === unit
  );

  const now = new Date().toISOString();
  let savedItem: InventoryItem;

  if (match) {
    match.quantity += quantity;
    match.updatedAt = now;
    savedItem = match;
  } else {
    savedItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sku,
      name,
      quantity,
      locationId,
      unit,
      updatedAt: now,
    };
    items.push(savedItem);
  }

  saveStoredData(INVENTORY_KEY, items);

  const receipts = getReceiptHistory();
  receipts.unshift({
    id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sku,
    name,
    quantity,
    locationId,
    unit,
    receivedAt: now,
  });
  saveStoredData(RECEIPTS_KEY, receipts.slice(0, 50));

  return savedItem;
}

export function moveInventory({
  itemId,
  quantity,
  toLocationId,
  user,
}: {
  itemId: string;
  quantity: number;
  toLocationId?: string;
  user: string;
}): InventoryMovement {
  const items = getInventoryItems();
  const item = items.find((record) => record.id === itemId);

  if (!item) {
    throw new Error("Inventory item not found.");
  }

  if (quantity <= 0 || quantity > item.quantity) {
    throw new Error("Quantity must be greater than zero and less than or equal to the available stock.");
  }

  const fromLocationId = item.locationId;
  const now = new Date().toISOString();

  if (quantity === item.quantity) {
    item.locationId = toLocationId;
    item.updatedAt = now;
  } else {
    item.quantity -= quantity;
    item.updatedAt = now;

    const existingDestination = items.find(
      (record) =>
        record.sku.toLowerCase() === item.sku.toLowerCase() &&
        record.locationId === toLocationId &&
        record.unit === item.unit
    );

    if (existingDestination) {
      existingDestination.quantity += quantity;
      existingDestination.updatedAt = now;
    } else {
      items.push({
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sku: item.sku,
        name: item.name,
        quantity,
        locationId: toLocationId,
        unit: item.unit,
        updatedAt: now,
      });
    }
  }

  saveStoredData(INVENTORY_KEY, items);

  const movements = getMovementHistory();
  const movement: InventoryMovement = {
    id: `movement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sku: item.sku,
    name: item.name,
    quantity,
    fromLocationId,
    toLocationId,
    movedAt: now,
    user,
  };
  movements.unshift(movement);
  saveStoredData(MOVEMENTS_KEY, movements.slice(0, 50));

  return movement;
}

export interface InventoryShipment {
  id: string;
  orderNumber: string;
  sku: string;
  name: string;
  quantity: number;
  locationId?: string;
  destination: string;
  shippedAt: string;
  user: string;
}

export interface InventoryAdjustment {
  id: string;
  itemId: string;
  sku: string;
  name: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  adjustedAt: string;
  user: string;
}

export function getShipmentHistory(): InventoryShipment[] {
  return getStoredData<InventoryShipment>(SHIPMENTS_KEY);
}

export function getAdjustmentHistory(): InventoryAdjustment[] {
  return getStoredData<InventoryAdjustment>(ADJUSTMENTS_KEY);
}

export function shipInventory({
  orderNumber,
  itemId,
  quantity,
  destination,
  user,
}: {
  orderNumber: string;
  itemId: string;
  quantity: number;
  destination: string;
  user: string;
}): InventoryShipment {
  const items = getInventoryItems();
  const item = items.find((entry) => entry.id === itemId);

  if (!item) {
    throw new Error("Inventory item not found.");
  }

  if (quantity <= 0 || quantity > item.quantity) {
    throw new Error("Invalid shipment quantity.");
  }

  const now = new Date().toISOString();
  const locationId = item.locationId;

  if (quantity === item.quantity) {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index !== -1) {
      items.splice(index, 1);
    }
  } else {
    item.quantity -= quantity;
    item.updatedAt = now;
  }

  saveStoredData(INVENTORY_KEY, items);

  const shipments = getShipmentHistory();
  const shipment: InventoryShipment = {
    id: `shipment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    orderNumber,
    sku: item.sku,
    name: item.name,
    quantity,
    locationId,
    destination,
    shippedAt: now,
    user,
  };

  shipments.unshift(shipment);
  saveStoredData(SHIPMENTS_KEY, shipments.slice(0, 50));

  return shipment;
}

export function adjustInventory({
  itemId,
  newQuantity,
  reason,
  user,
}: {
  itemId: string;
  newQuantity: number;
  reason: string;
  user: string;
}): InventoryAdjustment {
  const items = getInventoryItems();
  const item = items.find((entry) => entry.id === itemId);

  if (!item) {
    throw new Error("Inventory item not found.");
  }

  if (newQuantity < 0) {
    throw new Error("Adjusted quantity cannot be negative.");
  }

  const previousQuantity = item.quantity;
  item.quantity = newQuantity;
  item.updatedAt = new Date().toISOString();
  saveStoredData(INVENTORY_KEY, items);

  const adjustments = getAdjustmentHistory();
  const adjustment: InventoryAdjustment = {
    id: `adjustment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    itemId,
    sku: item.sku,
    name: item.name,
    previousQuantity,
    newQuantity,
    reason,
    adjustedAt: new Date().toISOString(),
    user,
  };

  adjustments.unshift(adjustment);
  saveStoredData(ADJUSTMENTS_KEY, adjustments.slice(0, 50));

  return adjustment;
}
