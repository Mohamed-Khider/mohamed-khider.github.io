"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import { getPackingRecords } from "../lib/packingManagement";

export default function PackingModulePage() {
  const router = useRouter();
  const [recordCount, setRecordCount] = useState(0);

  useEffect(() => {
    const records = getPackingRecords();
    setRecordCount(records.length);
  }, []);

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="B2B Order Packing System"
          subtitle="Manage packing orders, track boxes, and generate packing lists"
          showBack={true}
          showLogout={true}
        />

        {/* Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "24px",
            }}
          >
            <p style={{ fontSize: "32px", margin: "0 0 8px 0" }}>📦</p>
            <p style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "700" }}>
              {recordCount}
            </p>
            <p style={{ margin: "0", color: "#6b7280", fontSize: "13px" }}>
              Packing Records
            </p>
          </div>

          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "24px",
            }}
          >
            <p style={{ fontSize: "32px", margin: "0 0 8px 0" }}>📋</p>
            <p style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "700" }}>
              Ready
            </p>
            <p style={{ margin: "0", color: "#6b7280", fontSize: "13px" }}>
              Start Packing
            </p>
          </div>

          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "24px",
            }}
          >
            <p style={{ fontSize: "32px", margin: "0 0 8px 0" }}>📊</p>
            <p style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "700" }}>
              Export
            </p>
            <p style={{ margin: "0", color: "#6b7280", fontSize: "13px" }}>
              PDF & Excel
            </p>
          </div>
        </div>

        {/* Main Actions */}
        <div className="card">
          <h3>Getting Started</h3>
          <p style={{ color: "#6b7280", marginBottom: "20px" }}>
            Create a new packing order to begin the packing process. You can import
            items from an Excel file or add them manually.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {/* New Order Card */}
            <div
              onClick={() => router.push("/packing/new-order")}
              style={{
                padding: "24px",
                border: "2px solid #3b82f6",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.3s",
                backgroundColor: "#eff6ff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(59, 130, 246, 0.2)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <p style={{ fontSize: "24px", margin: "0 0 8px 0" }}>🆕</p>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600" }}>
                New Packing Order
              </h4>
              <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>
                Start a new order and begin packing items into boxes
              </p>
            </div>

            {/* History Card */}
            <div
              onClick={() => router.push("/packing/history")}
              style={{
                padding: "24px",
                border: "2px solid #10b981",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.3s",
                backgroundColor: "#f0fdf4",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(16, 185, 129, 0.2)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <p style={{ fontSize: "24px", margin: "0 0 8px 0" }}>📚</p>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600" }}>
                Packing History
              </h4>
              <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>
                View, edit, and export completed packing orders
              </p>
            </div>

            {/* Documentation Card */}
            <div
              onClick={() => {
                alert(
                  "Process:\n\n1. Create new packing order with client details\n2. Upload Excel packing list or add items manually\n3. Choose box ID type (Generated or Number)\n4. For each box: scan items and add to carton\n5. Complete box and start new one\n6. Export to PDF or Excel when done"
                );
              }}
              style={{
                padding: "24px",
                border: "2px solid #f59e0b",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.3s",
                backgroundColor: "#fffbeb",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(245, 158, 11, 0.2)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <p style={{ fontSize: "24px", margin: "0 0 8px 0" }}>❓</p>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600" }}>
                How It Works
              </h4>
              <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>
                Learn about the packing workflow and features
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="card">
          <h3>System Features</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {[
              { icon: "📦", title: "Box ID Generation", desc: "Auto-generate IDs based on client name" },
              { icon: "📝", title: "Item Tracking", desc: "Track pack_unit and pack_l1 types" },
              { icon: "✅", title: "Quantity Validation", desc: "System warns if qty exceeds order" },
              { icon: "📁", title: "Excel Import", desc: "Upload packing lists directly" },
              { icon: "📊", title: "Export Options", desc: "Generate PDF and Excel reports" },
              { icon: "💾", title: "Records Storage", desc: "Save packing history for future" },
              { icon: "🔄", title: "Edit Records", desc: "Correct mistakes anytime" },
              { icon: "🎯", title: "Progress Tracking", desc: "Real-time packing progress" },
            ].map((feature, idx) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  borderLeft: "4px solid #3b82f6",
                }}
              >
                <p style={{ margin: "0 0 4px 0", fontSize: "18px" }}>
                  {feature.icon}
                </p>
                <p style={{ margin: "0 0 4px 0", fontWeight: "600", fontSize: "13px" }}>
                  {feature.title}
                </p>
                <p style={{ margin: "0", fontSize: "12px", color: "#6b7280" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#dbeafe",
            border: "1px solid #93c5fd",
            borderRadius: "8px",
            marginTop: "20px",
          }}
        >
          <p style={{ margin: "0", fontSize: "13px", color: "#1e40af" }}>
            <strong>💡 Tip:</strong> Use the generated Box IDs (e.g., "LB-001") for
            professional labeling. The system extracts the first 2 letters from the
            client name and auto-increments for each box.
          </p>
        </div>
      </div>
    </ProtectedPage>
  );
}
