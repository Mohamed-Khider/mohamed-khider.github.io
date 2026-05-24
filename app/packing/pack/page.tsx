"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../../components/ProtectedPage";
import PageHeader from "../../components/PageHeader";
import NotificationModal from "../../components/NotificationModal";
import {
  addBox,
  addItemToBox,
  validatePackingComplete,
  savePackingRecord,
  type PackingOrder,
  type Box,
  type PackingItem,
  BoxContent,
  getPackingRecord,
  getPackingRecords,
} from "../../lib/packingManagement";
import { useToast } from "../../components/ToastProvider";
import { generatePackingListPDF, exportPackingListExcel } from "../../lib/packingExport";
import { getInventoryItemById } from "../../lib/inventoryManagement";

export default function PackingPage() {
  const router = useRouter();

  // State
  const [packingOrder, setPackingOrder] = useState<PackingOrder | null>(null);
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [selectedItem, setSelectedItem] = useState<PackingItem | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [scanInput, setScanInput] = useState("");
  const { showToast } = useToast();
  

  // Track quantities per item per box
  const [itemQtyInCurrentBox, setItemQtyInCurrentBox] = useState<
    Record<string, number>
  >({});

  // UI state
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: "warning" | "success" | "info";
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Load packing order from session
    const stored = sessionStorage.getItem("current_packing_order");
    if (stored) {
      const order: PackingOrder = JSON.parse(stored);
      setPackingOrder(order);

      // Initialize first box
      if (order.boxes.length === 0) {
        const newBox = addBox(order);
        // Ensure we update the order to include the newly created box
        const updatedOrder: PackingOrder = { ...order, boxes: [...order.boxes, newBox] };
        setPackingOrder(updatedOrder);
        setCurrentBox(newBox);
      } else {
        setCurrentBox(order.boxes[order.boxes.length - 1]);
      }
    } else {
      router.push("/packing");
    }
  }, [router]);

  const openNotification = (
    title: string,
    message: string,
    type: "warning" | "success" | "info"
  ) => {
    setNotification({ title, message, type });
  };

  // Calculate remaining quantity for item
  const getRemainingQty = (item: PackingItem): number => {
    let totalPacked = 0;

    if (packingOrder) {
      for (const box of packingOrder.boxes) {
        totalPacked += box.contents
          .filter((c) => c.itemSku === item.sku)
          .reduce((sum, c) => sum + c.quantityPacked, 0);
      }
    }

    return item.quantity - totalPacked;
  };

  // Get quantity already in current box
  const getQtyInCurrentBox = (sku: string): number => {
    if (!currentBox) return 0;
    return currentBox.contents
      .filter((c) => c.itemSku === sku)
      .reduce((sum, c) => sum + c.quantityPacked, 0);
  };

  // Add item to box
  const handleAddItemToBox = () => {
    if (!selectedItem || !currentBox || !quantityInput) {
      showToast("Validation Error", "Select item and enter quantity", "warning");
      return;
    }

    const qty = parseInt(quantityInput, 10);

    if (isNaN(qty) || qty <= 0) {
      showToast("Validation Error", "Enter valid quantity", "warning");
      return;
    }

    const remaining = getRemainingQty(selectedItem);

    if (qty > remaining) {
      showToast(
        "Quantity Exceeded",
        `Only ${remaining} ${selectedItem.uom} remaining for ${selectedItem.name}`,
        "warning"
      );
      return;
    }

    // Add to current box
    const content = addItemToBox(currentBox, selectedItem, qty);

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      const boxIndex = updatedOrder.boxes.findIndex((b) => b.boxId === currentBox.boxId);
      if (boxIndex >= 0) {
        updatedOrder.boxes[boxIndex] = currentBox;
        setPackingOrder(updatedOrder);
      }
    }

    showToast(
      "Item Added",
      `${qty} ${selectedItem.uom} of ${selectedItem.name} added to ${currentBox.boxId}`,
      "success"
    );

    setSelectedItem(null);
    setQuantityInput("");
  };

  // Complete current box and start new one
  const handleCompleteBox = () => {
    if (!currentBox || currentBox.contents.length === 0) {
      showToast("Box Empty", "Add items before completing box", "warning");
      return;
    }

    if (packingOrder) {
      const newBox = addBox(packingOrder);
      const updatedOrder = { ...packingOrder, boxes: [...packingOrder.boxes, newBox] };
      setPackingOrder(updatedOrder);
      setCurrentBox(newBox);
      setItemQtyInCurrentBox({});

      showToast(
        "Box Completed",
        `${currentBox.boxId} completed with ${currentBox.totalItems} items. Starting ${newBox.boxId}`,
        "success"
      );
    }
  };

  // handle scan input (for future barcode scanning feature)
 const handleScan = (value: string) => {
  const scanned = value.trim().toLowerCase();

  const foundItem = packingOrder?.items.find(
    (item) => item.sku.toLowerCase() === scanned
  );

  if (!foundItem) {
    showToast("Not Found", value, "warning");
    return;
  }

  const  remaining  = getRemainingQty(foundItem);

  if (remaining <= 0) {
    showToast("Done", `${foundItem.sku} completed`, "info");
    return;
  }

  // 👉 set selected item (IMPORTANT)
  setSelectedItem(foundItem);

  addItemToBox(currentBox, foundItem, 1);

  setPackingOrder({ ...packingOrder });

  showToast(
    "Scanned",
    `${foundItem.sku} | Remaining: ${remaining - 1}`,
    "success"
  );
};

  // Undo last item in box
  const handleUndoLastItem = () => {
    const [history, setHistory] = useState<BoxContent[][]>([]);
const [redoStack, setRedoStack] = useState<BoxContent[][]>([]);
    if (!currentBox || currentBox.contents.length === 0) {
      showToast("No Items", "Nothing to undo", "warning");
      return;
    }
    setHistory([...history, [...currentBox.contents]]);
setRedoStack([]);

    const lastContent = currentBox.contents[currentBox.contents.length - 1];
    currentBox.contents.pop();
    currentBox.totalItems -= lastContent.quantityPacked;

    if (packingOrder) {
      setPackingOrder({ ...packingOrder });
    }

    showToast(
      "Item Removed",
      `Removed ${lastContent.quantityPacked} ${lastContent.uom} of ${lastContent.itemName}`,
      "info"
    );
  };

  // Finish packing
  const handleFinishPacking = () => {
    if (!packingOrder) return;

    const validation = validatePackingComplete(packingOrder);

    if (!validation.valid) {
      showToast(
        "Incomplete Packing",
        `Missing: ${validation.missing.slice(0, 2).join(", ")}...`,
        "warning"
      );
      return;
    }

    // Mark as completed
    const completedOrder = {
      ...packingOrder,
      status: "completed" as const,
      completedAt: new Date().toISOString(),
    };

    // Save record
    savePackingRecord({
      orderId: packingOrder.orderId,
      clientName: packingOrder.clientName,
      packingData: completedOrder,
      savedAt: new Date().toISOString(),
    });

    sessionStorage.removeItem("current_packing_order");

    showToast(
      "Packing Complete",
      "Your packing order has been saved",
      "success"
    );

    setTimeout(() => {
      router.push("/packing/history");
    }, 1500);
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!packingOrder) return;
    setIsExporting(true);

    try {
      await generatePackingListPDF(packingOrder);
      showToast("PDF Exported", "Packing list saved to PDF", "success");
    } catch (error) {
      showToast("Export Failed", String(error), "warning");
    } finally {
      setIsExporting(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (!packingOrder) return;
    setIsExporting(true);

    try {
      await exportPackingListExcel(packingOrder);
      showToast(
        "Excel Exported",
        "Packing list saved to Excel",
        "success"
      );
    } catch (error) {
      showToast("Export Failed", String(error), "warning");
    } finally {
      setIsExporting(false);
    }
  };

  if (!packingOrder || !currentBox) {
    return (
      <ProtectedPage>
        <div className="container">
          <p>Loading packing order...</p>
        </div>
      </ProtectedPage>
    );
  }

  const incompleteness = validatePackingComplete(packingOrder);
  const completionPercent = Math.round(
    (packingOrder.boxes.reduce((sum, b) => sum + b.totalItems, 0) /
      packingOrder.items.reduce((sum, i) => sum + i.quantity, 0)) *
    100
  );

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Packing Order"
          subtitle={`Order: ${packingOrder.orderId} | Client: ${packingOrder.clientName}`}
          showBack={true}
          showLogout={true}
        />
        <input
          autoFocus
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleScan(scanInput);
              setScanInput("");
            }
          }}
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        {/* Progress Bar */}
        <div className="card">
          <h3>Packing Progress</h3>
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                width: "100%",
                height: "24px",
                backgroundColor: "#e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${completionPercent}%`,
                  height: "100%",
                  backgroundColor: completionPercent === 100 ? "#10b981" : "#3b82f6",
                  transition: "width 0.3s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                {completionPercent > 10 && `${completionPercent}%`}
              </div>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Boxes: <strong>{packingOrder.boxes.length}</strong> | Items Packed:{" "}
            <strong>
              {packingOrder.boxes.reduce((sum, b) => sum + b.totalItems, 0)}/{" "}
              {packingOrder.items.reduce((sum, i) => sum + i.quantity, 0)}
            </strong>
          </p>
        </div>

       
        {/* Detailed Progress Sidebar */}
        <div
          style={{
            position: "fixed",
            right: 0,
            top: 80,
            width: "300px",
            height: "80vh",
            overflowY: "auto",
            background: "#fff",
            borderLeft: "1px solid #e5e7eb",
            padding: "12px",
          }}
        >
          <h4 style={{ marginBottom: "10px" }}>📊 Progress</h4>

          {packingOrder.items.map((item) => {
            const remaining = getRemainingQty(item);
            const packed = item.quantity - remaining;

            return (
              <div key={item.sku} style={{ marginBottom: "8px" }}>
                <strong>{item.sku}</strong>
                <div style={{ fontSize: "12px" }}>
                  {packed}/{item.quantity}
                </div>
                <div
                  style={{
                    height: "6px",
                    background: "#e5e7eb",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    style={{
                      width: `${(packed / item.quantity) * 100}%`,
                      background: "#10b981",
                      height: "100%",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Box */}
        <div className="card">
          <h3>Current Box: {currentBox.boxId}</h3>
           {/* Box Selector */}
        <select
          value={currentBox.boxId}
          onChange={(e) => {
            const box = packingOrder.boxes.find(b => b.boxId === e.target.value);
            if (box) setCurrentBox(box);
          }}
        >
          {packingOrder.boxes.map(box => (
            <option key={box.boxId} value={box.boxId}>
              {box.boxId}
            </option>
          ))}
        </select>


          {currentBox.contents.length > 0 && (
            <div
              style={{
                marginBottom: "20px",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "8px", textAlign: "left" }}>Item</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>Qty</th>
                    <th style={{ padding: "8px", textAlign: "center" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBox.contents.map((content, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "8px" }}>
                        <strong>{content.itemSku}</strong>
                        <br />
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          {content.itemName}
                        </span>
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        {content.quantityPacked} {content.uom}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "center",
                          fontSize: "11px",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 6px",
                            backgroundColor:
                              content.packType === "pack_unit"
                                ? "#dcfce7"
                                : "#fef3c7",
                            borderRadius: "4px",
                          }}
                        >
                          {content.packType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            Total in Box: <strong>{currentBox.totalItems} items</strong>
          </p>
        </div>

        {/* Add Item to Box */}
        <div className="card">

{/* Future scan input for barcode scanning */}
          <input
  placeholder="Scan or type SKU..."
  value={scanInput}
  onChange={(e) => setScanInput(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handleScan(scanInput);
      setScanInput("");
    }
  }}
  style={{
    width: "100%",
    padding: "12px",
    border: "2px solid #3b82f6",
    borderRadius: "8px",
    marginBottom: "12px",
  }}
/>
          <h3>Add Item to Box</h3>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="item-select" style={{ display: "block", marginBottom: "8px" }}>
              Select Item
            </label>
            <select
              id="item-select"
              value={selectedItem?.sku ?? ""}
              onChange={(e) => {
                const item = packingOrder.items.find((i) => i.sku === e.target.value);
                setSelectedItem(item || null);
              }}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
            >
              <option value="">-- Select Item --</option>
              {packingOrder.items.map((item) => {
                const remaining = getRemainingQty(item);
                return (
                  <option key={item.sku} value={item.sku} disabled={remaining <= 0}>
                    {item.name} (SKU: {item.sku}) - {remaining} remaining
                  </option>
                );
              })}
            </select>
          </div>

          {selectedItem && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: "#eff6ff",
                borderRadius: "6px",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                <strong>{selectedItem.name}</strong>
              </p>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6b7280" }}>
                Pack Type: {selectedItem.packType} | UOM: {selectedItem.uom}
              </p>
              <p style={{ margin: "0", fontSize: "12px", color: "#059669" }}>
                Remaining: <strong>{getRemainingQty(selectedItem)} {selectedItem.uom}</strong>
              </p>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div>
              <label htmlFor="quantity" style={{ display: "block", marginBottom: "4px" }}>
                Quantity to Add
              </label>
              <input
                id="quantity"
                type="number"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="Enter quantity"
                disabled={!selectedItem}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
              />
            </div>
            <button
              className="primary-button"
              onClick={handleAddItemToBox}
              disabled={!selectedItem}
            >
              Add to Box
            </button>
            <button
              className="copy-button"
              onClick={handleUndoLastItem}
              disabled={currentBox.contents.length === 0}
            >
              Undo
            </button>
          </div>
        </div>

        {/* Box Controls */}
        <div className="button-group">
          <button
            className="primary-button"
            onClick={handleCompleteBox}
            disabled={currentBox.contents.length === 0}
          >
            Complete Box & New Box
          </button>
          <button
            className="second-button"
            onClick={handleFinishPacking}
            disabled={incompleteness.missing.length > 0}
          >
            Finish Packing
          </button>
        </div>

        {/* Export Options */}
        {packingOrder.status === "completed" && (
          <div className="card">
            <h3>Export Options</h3>
            <div className="button-group">
              <button
                className="second-button"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                📄 Export PDF
              </button>
              <button
                className="second-button"
                onClick={handleExportExcel}
                disabled={isExporting}
              >
                📊 Export Excel
              </button>
            </div>
          </div>
        )}

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
