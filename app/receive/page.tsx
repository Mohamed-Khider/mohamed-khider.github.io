"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import {
  initializeInventory,
  getInventoryItems,
  receiveInventory,
  getReceiptHistory,
  InventoryItem,
  InventoryReceipt,
} from "../lib/inventoryManagement";
import { initializeLocations, getAllLocations, WarehouseLocation } from "../lib/locationManagement";

export default function ReceivePage() {
  const currentUser = getCurrentUser();
  const canReceive = hasPermission(currentUser, "receive_goods");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializeInventory();
    initializeLocations();
    refreshData();
  }, []);

  const refreshData = () => {
    setInventory(getInventoryItems());
    setReceipts(getReceiptHistory().slice(0, 10));
    setLocations(getAllLocations());
  };

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canReceive) {
      setError("You do not have permission to receive inventory.");
      return;
    }

    if (!sku.trim() || !name.trim()) {
      setError("Enter both SKU and item name.");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    try {
      receiveInventory({
        sku: sku.trim(),
        name: name.trim(),
        quantity,
        locationId,
        unit: unit.trim() || "pcs",
      });
      openNotification("Goods Received", `Received ${quantity} ${unit} of ${name} (${sku}).`, "success");
      setSku("");
      setName("");
      setQuantity(1);
      setUnit("pcs");
      setLocationId(undefined);
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to receive inventory.");
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Receive Inventory"
          subtitle="Log incoming goods and assign them to a warehouse location."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h2>Receive Shipment</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="receive-sku">SKU</label>
              <input
                id="receive-sku"
                type="text"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Enter SKU"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="receive-name">Item Name</label>
              <input
                id="receive-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Item description"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="receive-quantity">Quantity</label>
              <input
                id="receive-quantity"
                type="number"
                value={quantity}
                min={1}
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="receive-unit">Unit of Measure</label>
              <input
                id="receive-unit"
                type="text"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="pcs, box, pallet"
              />
            </div>

            <div className="form-field">
              <label htmlFor="receive-location">Assign Location</label>
              <select
                id="receive-location"
                value={locationId ?? ""}
                onChange={(event) => setLocationId(event.target.value || undefined)}
              >
                <option value="">-- Select a location --</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.zone} / {location.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>}

            <button className="primary-button" type="submit" disabled={!canReceive}>
              Save Receipt
            </button>
            {!canReceive && (
              <div className="warning-banner" style={{ marginTop: 16 }}>
                Your account is missing receive permissions. Contact an administrator.
              </div>
            )}
          </form>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Recent Receipts</h3>
          {receipts.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>Date</th>
                    <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Item</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{new Date(receipt.receivedAt).toLocaleString()}</td>
                      <td style={{ padding: 12 }}>{receipt.sku}</td>
                      <td style={{ padding: 12 }}>{receipt.name}</td>
                      <td style={{ padding: 12 }}>{receipt.quantity} {receipt.unit}</td>
                      <td style={{ padding: 12 }}>{receipt.locationId ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No receiving activity yet.</p>
          )}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Current Stock</h3>
          {inventory.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Item</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Unit</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{item.sku}</td>
                      <td style={{ padding: 12 }}>{item.name}</td>
                      <td style={{ padding: 12 }}>{item.quantity}</td>
                      <td style={{ padding: 12 }}>{item.unit}</td>
                      <td style={{ padding: 12 }}>{item.locationId ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No inventory records are available yet.</p>
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
