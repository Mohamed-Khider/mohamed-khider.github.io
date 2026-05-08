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

        <div className="card-grid">
          <button className="link-card" onClick={() => router.push("/pallet")}
            type="button">
            <span className="material-icons">inventory</span>
            <h2>Pallet Labels</h2>
          </button>

          <button className="link-card" onClick={() => router.push("/section")}
            type="button">
            <span className="material-icons">grid_view</span>
            <h2>Section Labels</h2>
          </button>

          <button className="link-card" onClick={() => router.push("/generate-multi-barcode")}
            type="button">
            <span className="material-symbols-outlined">barcode</span>
            <h2>Multi Barcode Generator</h2>
          </button>

          <button className="link-card" onClick={() => router.push("/generate-barcode")}
            type="button">
            <span className="material-symbols-outlined">barcode</span>
            <h2>Single Barcode Generator</h2>
          </button>
        </div>
      </div>
    </ProtectedPage>
  );
}
