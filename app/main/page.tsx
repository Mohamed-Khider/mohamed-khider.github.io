"use client";

import { useRouter } from "next/navigation";
import ProtectedPage from "../components/ProtectedPage";

export default function MainPage() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("auth");
    router.push("/");
  };

  return (
    <ProtectedPage>
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Warehouse Label System</h1>
            <p>Choose a tool to generate and print labels quickly.</p>
          </div>
          <button className="second-button" onClick={handleLogout}>
            <span className="material-icons">logout</span> Logout
          </button>
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
