"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { initializeLocations, getAllLocations, createLocation, WarehouseLocation } from "../lib/locationManagement";
import { getInventoryItems, getInventoryItemsByLocation } from "../lib/inventoryManagement";
import NotificationModal from "../components/NotificationModal";

export default function LocationsPage() {
  const currentUser = getCurrentUser();
  const canManage = hasPermission(currentUser, "manage_locations");

  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializeLocations();
    loadLocations();
  }, []);

  const loadLocations = () => {
    setLocations(getAllLocations());
  };

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const totalAssigned = (locationId: string) => {
    return getInventoryItemsByLocation(locationId).reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleCreateLocation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      openNotification("Permission Required", "You do not have permission to manage locations.", "warning");
      return;
    }

    if (!name.trim() || !zone.trim()) {
      openNotification("Missing values", "Provide both location name and zone.", "warning");
      return;
    }

    createLocation({
      name: name.trim(),
      zone: zone.trim(),
      description: description.trim() || undefined,
      capacity: capacity > 0 ? capacity : undefined,
    });

    openNotification("Location Created", `${name.trim()} was added to ${zone.trim()}.`, "success");
    setName("");
    setZone("");
    setDescription("");
    setCapacity(0);
    loadLocations();
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Warehouse Locations"
          subtitle="Manage storage locations and review assigned stock."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h2>Location Inventory</h2>
          {locations.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>Location</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Zone</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Capacity</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Assigned Qty</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location) => (
                    <tr key={location.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{location.name}</td>
                      <td style={{ padding: 12 }}>{location.zone}</td>
                      <td style={{ padding: 12 }}>{location.capacity ?? "—"}</td>
                      <td style={{ padding: 12 }}>{totalAssigned(location.id)}</td>
                      <td style={{ padding: 12 }}>{location.active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No locations defined yet.</p>
          )}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Add New Location</h3>
          <form onSubmit={handleCreateLocation}>
            <div className="form-field">
              <label htmlFor="location-name">Location Name</label>
              <input
                id="location-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter location name"
              />
            </div>

            <div className="form-field">
              <label htmlFor="location-zone">Zone</label>
              <input
                id="location-zone"
                type="text"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                placeholder="Warehouse zone"
              />
            </div>

            <div className="form-field">
              <label htmlFor="location-capacity">Capacity</label>
              <input
                id="location-capacity"
                type="number"
                value={capacity}
                min={0}
                onChange={(event) => setCapacity(Number(event.target.value))}
                placeholder="Optional capacity"
              />
            </div>

            <div className="form-field">
              <label htmlFor="location-description">Description</label>
              <textarea
                id="location-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional notes for this storage location"
              />
            </div>

            <button className="primary-button" type="submit" disabled={!canManage}>
              Create Location
            </button>
            {!canManage && (
              <div className="warning-banner" style={{ marginTop: 16 }}>
                Only users with location management permission can create new warehouse locations.
              </div>
            )}
          </form>
        </div>

        <NotificationModal
          open={!!notification}
          title={notification?.title ?? "Notification"}
          message={notification?.message ?? ""}
          type={notification?.type ?? "info"}
          onClose={() => setNotification(null)}
        />
      </div>
    </ProtectedPage>
  );
}
