"use client";

import { useRouter } from "next/navigation";
import ProtectedPage from "../components/ProtectedPage";
import { getCurrentUser, logoutUser } from "../lib/userManagement";

export default function MainPage() {
  const router = useRouter();
  const currentUser = getCurrentUser();

  const handleLogout = () => {
    logoutUser();
    router.push("/");
  };

  return (
    <ProtectedPage>
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Warehouse Label System</h1>
            <p>Choose a tool to generate and print labels quickly.</p>
            {currentUser && (
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Logged in as: <strong>{currentUser.username}</strong> ({currentUser.role})
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {currentUser?.role === 'admin' && (
              <button className="primary-button" onClick={() => router.push("/admin")}>
                <span className="material-icons">admin_panel_settings</span> Admin
              </button>
            )}
            <button className="second-button" onClick={handleLogout}>
              <span className="material-icons">logout</span> Logout
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 26, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <button className="link-card" onClick={() => router.push("/receive")} type="button">
            <span className="material-icons">inventory_2</span>
            <h2>Receive Goods</h2>
            <p>Log inbound shipments and stage inventory.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/locations")} type="button">
            <span className="material-icons">location_on</span>
            <h2>Locations</h2>
            <p>Manage racks, zones, and storage assignments.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/stock-movement")} type="button">
            <span className="material-icons">swap_horiz</span>
            <h2>Stock Movement</h2>
            <p>Transfer products between locations safely.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/shipments")} type="button">
            <span className="material-icons">local_shipping</span>
            <h2>Shipments</h2>
            <p>Pick, pack, and dispatch outbound orders.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/cycle-count")} type="button">
            <span className="material-icons">inventory</span>
            <h2>Cycle Count</h2>
            <p>Adjust stock counts and resolve discrepancies.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/generate-barcode")} type="button">
            <span className="material-symbols-outlined">qr_code</span>
            <h2>Single Barcode</h2>
            <p>Create and print one barcode label at a time.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/generate-multi-barcode")} type="button">
            <span className="material-symbols-outlined">grid_view</span>
            <h2>Multi Barcode</h2>
            <p>Generate bulk barcode labels and export PDFs.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/pallet")} type="button">
            <span className="material-symbols-outlined">inventory_2</span>
            <h2>Pallet Labels</h2>
            <p>Generate pallet barcode sequences and ZPL output.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/section")} type="button">
            <span className="material-symbols-outlined">place</span>
            <h2>Section Labels</h2>
            <p>Build section labels for warehouse rack locations.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/labels")} type="button">
            <span className="material-symbols-outlined">label</span>
            <h2>Label Hub</h2>
            <p>Open unified label management and printer profiles.</p>
          </button>

          <button className="link-card" onClick={() => router.push("/reports")} type="button">
            <span className="material-symbols-outlined">insights</span>
            <h2>Reports</h2>
            <p>View stock, receipts, movements, and shipments.</p>
          </button>
        </div>
      </div>
    </ProtectedPage>
  );
}
