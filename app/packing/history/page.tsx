"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../../components/ProtectedPage";
import PageHeader from "../../components/PageHeader";
import NotificationModal from "../../components/NotificationModal";
import {
  getPackingRecords,
  deletePackingRecord,
  type PackingRecord,
} from "../../lib/packingManagement";
import {
  generatePackingListPDF,
  exportPackingListExcel,
  generatePackingSummary,
} from "../../lib/packingExport";

export default function PackingHistoryPage() {
  const router = useRouter();

  const [records, setRecords] = useState<PackingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PackingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: "warning" | "success" | "info";
  } | null>(null);

  useEffect(() => {
    const saved = getPackingRecords();
    setRecords(saved);
    setIsLoading(false);
  }, []);

  const openNotification = (
    title: string,
    message: string,
    type: "warning" | "success" | "info" = "info"
  ) => {
    setNotification({ title, message, type });
  };

  const handleViewDetails = (record: PackingRecord) => {
    setSelectedRecord(record);
  };

  const handleDelete = (orderId: string) => {
    if (confirm("Are you sure you want to delete this packing record?")) {
      deletePackingRecord(orderId);
      setRecords(records.filter((r) => r.orderId !== orderId));
      setSelectedRecord(null);
      openNotification("Deleted", "Packing record deleted", "success");
    }
  };

  const handleExportPDF = async (record: PackingRecord) => {
    setIsExporting(true);
    try {
      await generatePackingListPDF(record.packingData);
      openNotification("Exported", "PDF saved successfully", "success");
    } catch (error) {
      openNotification("Export Failed", String(error), "warning");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async (record: PackingRecord) => {
    setIsExporting(true);
    try {
      await exportPackingListExcel(record.packingData);
      openNotification("Exported", "Excel file downloaded", "success");
    } catch (error) {
      openNotification("Export Failed", String(error), "warning");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedPage>
        <div className="container">
          <p>Loading records...</p>
        </div>
      </ProtectedPage>
    );
  }

  const summary = selectedRecord
    ? generatePackingSummary(selectedRecord.packingData)
    : null;

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Packing History"
          subtitle="View, edit, and manage completed packing orders"
          showBack={true}
          showLogout={true}
        />

        {records.length === 0 ? (
          <div className="card">
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              No packing records yet. Start a new packing order to get started.
            </p>
            <div className="button-group" style={{ marginTop: "20px" }}>
              <button
                className="primary-button"
                onClick={() => router.push("/packing/new-order")}
              >
                New Packing Order
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            {/* Records List */}
            <div className="card">
              <h3>Packing Records ({records.length})</h3>
              <div
                style={{
                  maxHeight: "600px",
                  overflowY: "auto",
                }}
              >
                {records.map((record, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleViewDetails(record)}
                    style={{
                      padding: "12px",
                      marginBottom: "8px",
                      border:
                        selectedRecord?.orderId === record.orderId
                          ? "2px solid #3b82f6"
                          : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        selectedRecord?.orderId === record.orderId
                          ? "#eff6ff"
                          : "#f9fafb",
                      transition: "all 0.2s",
                    }}
                  >
                    <p style={{ margin: "0 0 4px 0", fontWeight: "600" }}>
                      {record.orderId}
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6b7280" }}>
                      {record.clientName}
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#9ca3af" }}>
                      Boxes: <strong>{record.packingData.boxes.length}</strong>
                    </p>
                    <p style={{ margin: "0", fontSize: "11px", color: "#9ca3af" }}>
                      {new Date(record.savedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Details Panel */}
            {selectedRecord ? (
              <div className="card">
                <h3>Order Details</h3>

                {/* Summary */}
                {summary && (
                  <div
                    style={{
                      marginBottom: "16px",
                      padding: "12px",
                      backgroundColor: "#f0fdf4",
                      borderRadius: "8px",
                    }}
                  >
                    <p style={{ margin: "0 0 8px 0", fontWeight: "600" }}>
                      Summary
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: "13px" }}>
                      Boxes: <strong>{summary.totalBoxes}</strong>
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: "13px" }}>
                      Total Items: <strong>{summary.totalItems}</strong>
                    </p>
                    <p style={{ margin: "0", fontSize: "13px" }}>
                      Pack Types:{" "}
                      {Object.entries(summary.packTypeDistribution)
                        .map(
                          ([type, count]) =>
                            `${type}: ${count}`
                        )
                        .join(", ")}
                    </p>
                  </div>
                )}

                {/* Boxes */}
                <div style={{ marginBottom: "16px" }}>
                  <p style={{ fontWeight: "600", marginBottom: "8px" }}>
                    Boxes ({selectedRecord.packingData.boxes.length})
                  </p>
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {selectedRecord.packingData.boxes.map((box, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px",
                          marginBottom: "6px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      >
                        <p style={{ margin: "0 0 4px 0", fontWeight: "600" }}>
                          {box.boxId}
                        </p>
                        <p style={{ margin: "0", color: "#6b7280" }}>
                          {box.contents.length} items | {box.totalItems} units
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <button
                    className="primary-button"
                    onClick={() => handleExportPDF(selectedRecord)}
                    disabled={isExporting}
                    style={{ fontSize: "12px", padding: "8px" }}
                  >
                    📄 PDF
                  </button>
                  <button
                    className="second-button"
                    onClick={() => handleExportExcel(selectedRecord)}
                    disabled={isExporting}
                    style={{ fontSize: "12px", padding: "8px" }}
                  >
                    📊 Excel
                  </button>
                  <button
                    className="copy-button"
                    onClick={() => handleDelete(selectedRecord.orderId)}
                    style={{ fontSize: "12px", padding: "8px", gridColumn: "1 / -1" }}
                  >
                    Delete Record
                  </button>
                </div>
              </div>
            ) : (
              <div className="card">
                <p style={{ textAlign: "center", color: "#9ca3af" }}>
                  Select a record to view details
                </p>
              </div>
            )}
          </div>
        )}

        <div className="button-group" style={{ marginTop: "20px" }}>
          <button
            className="primary-button"
            onClick={() => router.push("/packing/new-order")}
          >
            + New Packing Order
          </button>
          <button
            className="second-button"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>

        <NotificationModal
          open={!!notification}
          title={notification?.title ?? ""}
          message={notification?.message ?? ""}
          type={notification?.type ?? "info"}
          onClose={() => setNotification(null)}
        />
      </div>
    </ProtectedPage>
  );
}
