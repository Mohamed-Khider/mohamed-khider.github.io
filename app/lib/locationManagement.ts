export interface WarehouseLocation {
  id: string;
  name: string;
  zone: string;
  description?: string;
  capacity?: number;
  active: boolean;
  createdAt: string;
}

const LOCATIONS_KEY = "warehouse_locations";

const DEFAULT_LOCATIONS: WarehouseLocation[] = [
  {
    id: "loc-receiving",
    name: "Receiving Bay",
    zone: "Receiving",
    description: "Temporary staging area for inbound goods.",
    capacity: 500,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "loc-a1",
    name: "A1 Rack",
    zone: "Zone A",
    description: "Standard pallet rack in Zone A.",
    capacity: 250,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "loc-b1",
    name: "B1 Rack",
    zone: "Zone B",
    description: "Standard pallet rack in Zone B.",
    capacity: 250,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "loc-c1",
    name: "C1 Rack",
    zone: "Zone C",
    description: "Standard pallet rack in Zone C.",
    capacity: 250,
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function getLocationsFromStorage(): WarehouseLocation[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCATIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveLocations(locations: WarehouseLocation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function initializeLocations(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(LOCATIONS_KEY)) {
    saveLocations(DEFAULT_LOCATIONS);
  }
}

export function getAllLocations(): WarehouseLocation[] {
  return getLocationsFromStorage();
}

export function getLocationById(locationId: string): WarehouseLocation | null {
  return getAllLocations().find((location) => location.id === locationId) || null;
}

export function getLocationsByZone(zone: string): WarehouseLocation[] {
  return getAllLocations().filter((location) => location.zone === zone);
}

export function createLocation({
  name,
  zone,
  description,
  capacity,
}: {
  name: string;
  zone: string;
  description?: string;
  capacity?: number;
}): WarehouseLocation {
  const locations = getAllLocations();
  const newLocation: WarehouseLocation = {
    id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    zone,
    description,
    capacity,
    active: true,
    createdAt: new Date().toISOString(),
  };

  locations.push(newLocation);
  saveLocations(locations);
  return newLocation;
}

export function updateLocation(locationId: string, updates: Partial<WarehouseLocation>): boolean {
  const locations = getAllLocations();
  const index = locations.findIndex((location) => location.id === locationId);

  if (index === -1) return false;
  locations[index] = { ...locations[index], ...updates };
  saveLocations(locations);
  return true;
}
