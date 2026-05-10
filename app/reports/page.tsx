"use client";

import { useEffect, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { initializeInventory, getStockSummary, getReceiptHistory, getMovementHistory, getShipmentHistory } from "../lib/inventoryManagement";

export default function ReportsPage() {
  const currentUser = getCurrentUser();
  const canViewReports = hasPermission(currentUser, "view_reports");
  const [summary, setSummary] = useState(getStockSummary());
  const [receipts, setReceipts] = useState(getReceiptHistory().slice(0, 10));
  const [movements, setMovements] = useState(getMovementHistory().slice(0, 10));
  const [shipments, setShipments] = useState(getShipmentHistory().slice(0, 10));

  useEffect(() => {
    initializeInventory();
    setSummary(getStockSummary());
    setReceipts(getReceiptHistory().slice(0, 10));
    setMovements(getMovementHistory().slice(0, 10));
    setShipments(getShipmentHistory().slice(0, 10));
  }, []);

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Warehouse Reports"
          subtitle="Review stock, receipts, and movement activity."
          showBack={true}
          showLogout={true}
        />

        {!canViewReports ? (
          <div className="card">
            <h2>Access Restricted</h2>
            <p>You do not have permission to view warehouse reports. Request access from an administrator.</p>
          </div>
        ) : (
          <>
            <div className="card">
              <h2>Stock Summary</h2>
              {summary.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                        <th style={{ textAlign: "left", padding: 12 }}>Name</th>
                        <th style={{ textAlign: "left", padding: 12 }}>Total Qty</th>
                        <th style={{ textAlign: "left", padding: 12 }}>Locations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((item) => (
                        <tr key={`${item.sku}-${item.unit}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 12 }}>{item.sku}</td>
                          <td style={{ padding: 12 }}>{item.name}</td>
                          <td style={{ padding: 12 }}>{item.totalQuantity} {item.unit}</td>
                          <td style={{ padding: 12 }}>{item.locations.map((location) => `${location.locationId ?? "Unassigned"}: ${location.quantity}`).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No stock summary available.</p>
              )}
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <h2>Recent Activity</h2>
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h3>Recent Receipts</h3>
                  {receipts.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ textAlign: "left", padding: 12 }}>When</th>
                            <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                            <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                            <th style={{ textAlign: "left", padding: 12 }}>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipts.map((receipt) => (
                            <tr key={receipt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 12 }}>{new Date(receipt.receivedAt).toLocaleString()}</td>
                              <td style={{ padding: 12 }}>{receipt.sku}</td>
                              <td style={{ padding: 12 }}>{receipt.quantity} {receipt.unit}</td>
                              <td style={{ padding: 12 }}>{receipt.locationId ?? "Unassigned"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No receipts found.</p>
                  )}
                </div>

                <div>
                  <h3>Recent Movements</h3>
                  {movements.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ textAlign: "left", padding: 12 }}>When</th>
                            <th style={{ textAlign: "left", padding: 12 }}>SKU</th>
                            <th style={{ textAlign: "left", padding: 12 }}>Qty</th>
                            <th style={{ textAlign: "left", padding: 12 }}>From / To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((movement) => (
                            <tr key={movement.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 12 }}>{new Date(movement.movedAt).toLocaleString()}</td>
                              <td style={{ padding: 12 }}>{movement.sku}</td>
                              <td style={{ padding: 12 }}>{movement.quantity}</td>
                              <td style={{ padding: 12 }}>{movement.fromLocationId ?? "Unassigned"} → {movement.toLocationId ?? "Unassigned"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No movements found.</p>
                  )}
                </div>

                <div>
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
                    <p>No shipments found.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
