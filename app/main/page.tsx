"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../components/ProtectedPage";
import {
  getAdjustmentHistory,
  getInventoryItems,
  getMovementHistory,
  getReceiptHistory,
  getShipmentHistory,
  getStockSummary,
  initializeInventory,
  type InventoryItem,
} from "../lib/inventoryManagement";
import { getAllLocations, initializeLocations } from "../lib/locationManagement";
import { getPackingRecords } from "../lib/packingManagement";
import { getCurrentUser, User } from "../lib/userManagement";

interface ActivityItem {
  label: string;
  detail: string;
  when: string;
  icon: string;
}

const quickActions = [
  { href: "/receive", label: "Receive goods", icon: "inventory_2", description: "Inbound dock intake" },
  { href: "/stock-movement", label: "Move stock", icon: "swap_horiz", description: "Transfer locations" },
  { href: "/packing", label: "Pack order", icon: "inventory", description: "Scan and box items" },
  { href: "/labels", label: "Print labels", icon: "label", description: "Zebra-ready output" },
];

const modules = [
  { href: "/locations", label: "Locations", icon: "location_on", tone: "green" },
  { href: "/shipments", label: "Shipments", icon: "local_shipping", tone: "blue" },
  { href: "/cycle-count", label: "Cycle Count", icon: "fact_check", tone: "amber" },
  { href: "/reports", label: "Reports", icon: "monitoring", tone: "slate" },
  { href: "/printer-settings", label: "Printers", icon: "print", tone: "blue" },
  { href: "/admin", label: "Admin", icon: "admin_panel_settings", tone: "amber" },
];

export default function MainPage() {
  const router = useRouter();
const [currentUser, setCurrentUser] =useState<User | null>(null);  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locationCount, setLocationCount] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [packingCount, setPackingCount] = useState(0);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setCurrentUser(getCurrentUser());
}, []);

  useEffect(() => {
    try {
    initializeInventory();
    initializeLocations();

    const inventoryItems = getInventoryItems();
    const receipts = getReceiptHistory().map((item) => ({
      label: "Receipt",
      detail: `${item.quantity} ${item.unit} of ${item.sku}`,
      when: item.receivedAt,
      icon: "call_received",
    }));
    const movements = getMovementHistory().map((item) => ({
      label: "Movement",
      detail: `${item.sku}: ${item.fromLocationId ?? "Unassigned"} to ${item.toLocationId ?? "Unassigned"}`,
      when: item.movedAt,
      icon: "swap_horiz",
    }));
    const shipments = getShipmentHistory().map((item) => ({
      label: "Shipment",
      detail: `${item.orderNumber} to ${item.destination}`,
      when: item.shippedAt,
      icon: "local_shipping",
    }));
    const adjustments = getAdjustmentHistory().map((item) => ({
      label: "Adjustment",
      detail: `${item.sku}: ${item.previousQuantity} to ${item.newQuantity}`,
      when: item.adjustedAt,
      icon: "tune",
    }));

    setItems(inventoryItems);
    setLocationCount(getAllLocations().filter((location) => location.active).length);
    setPackingCount(getPackingRecords().length);
    setActivity([...receipts, ...movements, ...shipments, ...adjustments].sort(
      (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
    ).slice(0, 8));
   } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const stockSummary = useMemo(() => getStockSummary(), [items]);
  const totalUnits = useMemo(
  () => items.reduce((sum, item) => sum + item.quantity, 0),
  [items]
);

const lowStock = useMemo(
  () => items.filter(item => item.quantity > 0 && item.quantity <= 5),
  [items]
);

const unassigned = useMemo(
  () => items.filter(item => !item.locationId),
  [items]
);
  if (loading) {
  return (
    <ProtectedPage>
      <div className="dashboard-loading">
        Loading warehouse data...
      </div>
    </ProtectedPage>
  );
}

const greeting = (() => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
})();

const refreshDashboard = () => {
  const inventoryItems = getInventoryItems();

  setItems(inventoryItems);
  setLocationCount(
    getAllLocations().filter(l => l.active).length
  );
  setPackingCount(getPackingRecords().length);
};

  return (
    <ProtectedPage>
      <div className="container dashboard-container">
        <section className="dashboard-hero">
          <div>
            <div className="eyebrow">Warehouse Command Center</div>
            <h1>  {greeting}, {currentUser?.username ?? "Operator"}</h1>
            <p>Track inventory, move stock, pack orders, and print Zebra-ready labels from one control surface.</p>
          </div>
          <div className="hero-status-panel">
            <span className="material-symbols-outlined">verified</span>
            <div>
              <strong>
  {items.length > 0
    ? "Warehouse Online"
    : "Awaiting Data"}
</strong>

<span>
  {items.length} inventory items loaded
</span>
              <span>Local data, backup, labels, and WMS workflows online</span>
            </div>
          </div>
        </section>

        <section className="metric-grid">
          <div className="metric-card">
            <span className="material-symbols-outlined">inventory_2</span>
            <div>
              <strong>{stockSummary.length}</strong>
              <span>Active SKUs</span>
            </div>
          </div>
          <div className="metric-card">
            <span className="material-symbols-outlined">pin_drop</span>
            <div>
              <strong>{locationCount}</strong>
              <span>Active locations</span>
            </div>
          </div>
          <div className="metric-card">
            <span className="material-symbols-outlined">tag</span>
            <div>
              <strong>{totalUnits}</strong>
              <span>Units on hand</span>
            </div>
          </div>
          <div className="metric-card alert">
            <span className="material-symbols-outlined">priority_high</span>
            <div>
              <strong>{lowStock.length}</strong>
              <span>Low stock SKUs</span>
            </div>
          </div>
          <div className="metric-card">
  <span className="material-symbols-outlined">
    package_2
  </span>

  <div>
    <strong>{packingCount}</strong>
    <span>Packed Orders</span>
  </div>
</div>

<div className="metric-card">
  <span className="material-symbols-outlined">
    warning
  </span>

  <div>
    <strong>{unassigned.length}</strong>
    <span>Unassigned Items</span>
  </div>
</div>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-panel span-2">
            <div className="panel-heading">
              <div>
                <h2>Quick Actions</h2>
                <p>Fast entry points for the floor team.</p>
              </div>
            </div>
            <div className="quick-action-grid">
              {quickActions.map((action) => (
                <button className="quick-action" key={action.href} type="button" onClick={() => router.push(action.href)}>
                  <span className="material-symbols-outlined">{action.icon}</span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Exceptions</h2>
                <p>Items that need attention.</p>
              </div>
            </div>
            <div className="exception-list">
              <div>
                <strong>{unassigned.length}</strong>
                <span>Unassigned inventory lines</span>
              </div>
              <div>
                <strong>{lowStock.length}</strong>
                <span>Low-stock lines at 5 or below</span>
              </div>
              <div>
                <strong>{packingCount}</strong>
                <span>Saved packing records</span>
              </div>
            </div>
          </div>

          <div className="dashboard-panel span-2">
            <div className="panel-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Latest operational events across the warehouse.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => router.push("/reports")}>Open Reports</button>
            </div>
            <div className="activity-list">
              {activity.length > 0 ? activity.map((item, index) => (
                <div className="activity-row" key={`${item.label}-${item.when}-${index}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <time>{new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(item.when))}</time>
                </div>
              )) : (
                <div className="empty-state">No warehouse activity yet.</div>
              )}
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Modules</h2>
                <p>Open any WMS workspace.</p>
              </div>
            </div>
            <div className="module-list">
              {modules
                .filter((module) => module.href !== "/admin" || currentUser?.role === "admin")
                .map((module) => (
                  <button className={`module-link ${module.tone}`} key={module.href} type="button" onClick={() => router.push(module.href)}>
                    <span className="material-symbols-outlined">{module.icon}</span>
                    <span>{module.label}</span>
                  </button>
                ))}
            </div>
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}
