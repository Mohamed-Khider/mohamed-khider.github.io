"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import {
  initializeInventory,
  getInventoryItems,
  moveInventory,
  InventoryItem,
} from "../lib/inventoryManagement";
import { initializeLocations, getAllLocations, WarehouseLocation } from "../lib/locationManagement";

export default function StockMovementPage() {
  const currentUser = getCurrentUser();
  const canMove = hasPermission(currentUser, "move_stock");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializeInventory();
    initializeLocations();
    refreshData();
  }, []);

  const refreshData = () => {
    setItems(getInventoryItems());
    setLocations(getAllLocations());
  };

  const selectedItem = items.find((item) => item.id === selectedItemId);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleMove = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canMove) {
      setError("You do not have permission to move stock.");
      return;
    }

    if (!selectedItem) {
      setError("Select an item to move.");
      return;
    }

    if (!destinationId) {
      setError("Choose a destination location.");
      return;
    }

    if (destinationId === selectedItem.locationId) {
      setError("Select a different destination from the current location.");
      return;
    }

    if (quantity <= 0 || quantity > selectedItem.quantity) {
      setError("Enter a valid quantity to transfer.");
      return;
    }

    try {
      moveInventory({
        itemId: selectedItem.id,
        quantity,
        toLocationId: destinationId,
        user: currentUser?.username ?? "unknown",
      });
      openNotification("Stock Moved", `${quantity} units of ${selectedItem.sku} were moved successfully.`, "success");
      setSelectedItemId("");
      setDestinationId("");
      setQuantity(1);
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move stock.");
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Stock Movement"
          subtitle="Transfer inventory between warehouse locations."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h2>Move Inventory</h2>
          <form onSubmit={handleMove}>
            <div className="form-field">
              <label htmlFor="stock-item">Select Item</label>
              <select
                id="stock-item"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
              >
                <option value="">-- Select an item --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name} ({item.quantity} {item.unit}) @ {item.locationId ?? "Unassigned"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="destination-location">Destination Location</label>
              <select
                id="destination-location"
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
              >
                <option value="">-- Select destination --</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.zone} / {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="move-quantity">Quantity</label>
              <input
                id="move-quantity"
                type="number"
                value={quantity}
                min={1}
                max={selectedItem?.quantity ?? 1}
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
              />
            </div>

            {selectedItem && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: 0 }}>
                  Current location: <strong>{selectedItem.locationId ?? "Unassigned"}</strong>
                </p>
              </div>
            )}

            {error && <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>}

            <button className="primary-button" type="submit" disabled={!canMove || !selectedItem}>
              Transfer Stock
            </button>
            {!canMove && (
              <div className="warning-banner" style={{ marginTop: 16 }}>
                This account cannot move stock. Contact an administrator to request warehouse transfer permission.
              </div>
            )}
          </form>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Pending Inventory</h3>
          {items.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Name</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{item.sku}</td>
                      <td style={{ padding: 12 }}>{item.name}</td>
                      <td style={{ padding: 12 }}>{item.quantity}</td>
                      <td style={{ padding: 12 }}>{item.locationId ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No inventory available for transfer.</p>
          )}
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
