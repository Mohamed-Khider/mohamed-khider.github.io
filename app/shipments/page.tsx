"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { initializeInventory, getInventoryItems, shipInventory, getShipmentHistory, InventoryItem, InventoryShipment } from "../lib/inventoryManagement";

export default function ShipmentsPage() {
  const currentUser = getCurrentUser();
  const canShip = hasPermission(currentUser, "create_shipments");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [shipments, setShipments] = useState<InventoryShipment[]>([]);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializeInventory();
    loadData();
  }, []);

  const loadData = () => {
    setItems(getInventoryItems().filter((item) => item.quantity > 0));
    setShipments(getShipmentHistory().slice(0, 10));
  };

  const selectedItem = items.find((item) => item.id === selectedItemId);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleShip = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canShip) {
      setError("You do not have permission to create shipments.");
      return;
    }

    if (!orderNumber.trim() || !selectedItem || !destination.trim()) {
      setError("Provide order number, item, and destination.");
      return;
    }

    if (quantity <= 0 || !selectedItem || quantity > selectedItem.quantity) {
      setError("Enter a valid quantity for shipment.");
      return;
    }

    try {
      shipInventory({
        orderNumber: orderNumber.trim(),
        itemId: selectedItem.id,
        quantity,
        destination: destination.trim(),
        user: currentUser?.username ?? "unknown",
      });
      openNotification("Shipment Created", `Shipment ${orderNumber.trim()} created for ${selectedItem.sku}.`, "success");
      setOrderNumber("");
      setSelectedItemId("");
      setDestination("");
      setQuantity(1);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shipment.");
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Outbound Shipments"
          subtitle="Pick, pack, and dispatch orders from warehouse stock."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h2>Create Shipment</h2>
          <form onSubmit={handleShip}>
            <div className="form-field">
              <label htmlFor="order-number">Order Number</label>
              <input
                id="order-number"
                type="text"
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="Enter outbound order number"
              />
            </div>

            <div className="form-field">
              <label htmlFor="shipment-item">Select Item</label>
              <select
                id="shipment-item"
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
              <label htmlFor="shipment-quantity">Quantity</label>
              <input
                id="shipment-quantity"
                type="number"
                value={quantity}
                min={1}
                max={selectedItem?.quantity ?? 1}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="shipment-destination">Destination</label>
              <input
                id="shipment-destination"
                type="text"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Customer or shipping dock"
              />
            </div>

            {error && <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>}

            <button className="primary-button" type="submit" disabled={!canShip || items.length === 0}>
              Create Shipment
            </button>
            {!canShip && (
              <div className="warning-banner" style={{ marginTop: 16 }}>
                This account cannot create shipments. Contact an administrator.
              </div>
            )}
          </form>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Recent Shipments</h3>
          {shipments.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>When</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Order</th>
                    <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>{new Date(shipment.shippedAt).toLocaleString()}</td>
                      <td style={{ padding: 12 }}>{shipment.orderNumber}</td>
                      <td style={{ padding: 12 }}>{shipment.sku}</td>
                      <td style={{ padding: 12 }}>{shipment.quantity}</td>
                      <td style={{ padding: 12 }}>{shipment.destination}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No shipments have been created yet.</p>
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
