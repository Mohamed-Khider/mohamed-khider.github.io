"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { initializeInventory, getInventoryItems, adjustInventory, getAdjustmentHistory, InventoryAdjustment, InventoryItem } from "../lib/inventoryManagement";

export default function CycleCountPage() {
  const currentUser = getCurrentUser();
  const canAdjust = hasPermission(currentUser, "adjust_inventory");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializeInventory();
    loadData();
  }, []);

  const loadData = () => {
    const currentItems = getInventoryItems();
    setItems(currentItems);
    setAdjustments(getAdjustmentHistory().slice(0, 10));
  };

  const selectedItem = items.find((item) => item.id === selectedItemId);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleAdjust = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canAdjust) {
      setError("You do not have permission to adjust inventory.");
      return;
    }

    if (!selectedItem) {
      setError("Select an item to adjust.");
      return;
    }

    if (newQuantity < 0) {
      setError("Quantity cannot be negative.");
      return;
    }

    if (!reason.trim()) {
      setError("Provide a reason for the adjustment.");
      return;
    }

    try {
      adjustInventory({
        itemId: selectedItem.id,
        newQuantity,
        reason: reason.trim(),
        user: currentUser?.username ?? "unknown",
      });
      openNotification("Inventory Adjusted", `${selectedItem.sku} quantity updated to ${newQuantity}.`, "success");
      setSelectedItemId("");
      setNewQuantity(0);
      setReason("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update inventory.");
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Cycle Count"
          subtitle="Correct stock levels and capture count adjustments."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h2>Adjust Inventory</h2>
          <form onSubmit={handleAdjust}>
            <div className="form-field">
              <label htmlFor="adjust-item">Select Item</label>
              <select
                id="adjust-item"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
              >
                <option value="">-- Select item --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name} ({item.quantity} {item.unit}) @ {item.locationId ?? "Unassigned"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="adjust-quantity">New Quantity</label>
              <input
                id="adjust-quantity"
                type="number"
                min={0}
                value={newQuantity}
                onChange={(event) => setNewQuantity(Number(event.target.value))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="adjust-reason">Reason</label>
              <textarea
                id="adjust-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Count variance, damaged goods, system correction"
              />
            </div>

            {error && <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>}

            <button className="primary-button" type="submit" disabled={!canAdjust || !selectedItem}>
              Save Adjustment
            </button>
            {!canAdjust && (
              <div className="warning-banner" style={{ marginTop: 16 }}>
                You need adjustment permission to update inventory counts.
              </div>
            )}
          </form>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Recent Adjustments</h3>
          {adjustments.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>When</th>
                    <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Previous</th>
                    <th style={{ textAlign: "left", padding: 12 }}>New</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adjustment) => (
                    <tr key={adjustment.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{new Date(adjustment.adjustedAt).toLocaleString()}</td>
                      <td style={{ padding: 12 }}>{adjustment.sku}</td>
                      <td style={{ padding: 12 }}>{adjustment.previousQuantity}</td>
                      <td style={{ padding: 12 }}>{adjustment.newQuantity}</td>
                      <td style={{ padding: 12 }}>{adjustment.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No inventory adjustments recorded yet.</p>
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
