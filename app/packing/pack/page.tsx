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
  type BoxContent,
} from "../../lib/packingManagement";
import { useToast } from "../../components/ToastProvider";
import { generatePackingListPDF, exportPackingListExcel } from "../../lib/packingExport";

export default function PackingPage() {
  const router = useRouter();

  // State
  const [packingOrder, setPackingOrder] = useState<PackingOrder | null>(null);
  const [currentBoxId, setCurrentBoxId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PackingItem | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [scanInput, setScanInput] = useState("");
  const { showToast } = useToast();

  // History/Redo for undo functionality
  const [history, setHistory] = useState<{ boxId: string; contents: BoxContent[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ boxId: string; contents: BoxContent[] }[]>([]);

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
        const updatedOrder: PackingOrder = { ...order, boxes: [newBox] };
        setPackingOrder(updatedOrder);
        setCurrentBoxId(newBox.boxId);
        saveSessionOrder(updatedOrder);
      } else {
        setCurrentBoxId(order.boxes[order.boxes.length - 1].boxId);
      }
    } else {
      router.push("/packing");
    }
  }, [router]);

  const saveSessionOrder = (order: PackingOrder) => {
    sessionStorage.setItem("current_packing_order", JSON.stringify(order));
  };

  const getCurrentBox = (): Box | null => {
    if (!packingOrder || !currentBoxId) return null;
    return packingOrder.boxes.find((b) => b.boxId === currentBoxId) || null;
  };

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

  // Add item to box
  const handleAddItemToBox = () => {
    if (!selectedItem || !quantityInput) {
      showToast("Validation Error", "Select item and enter quantity", "warning");
      return;
    }

    const currentBox = getCurrentBox();
    if (!currentBox) {
      showToast("Error", "No active box selected", "warning");
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

    // Save to history
    setHistory([...history, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    setRedoStack([]);

    // Add to current box
    const content = addItemToBox(currentBox, selectedItem, qty);

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      const boxIndex = updatedOrder.boxes.findIndex((b) => b.boxId === currentBox.boxId);
      if (boxIndex >= 0) {
        updatedOrder.boxes[boxIndex] = currentBox;
        setPackingOrder(updatedOrder);
        saveSessionOrder(updatedOrder);
      }
    }

    showToast(
      "Item Added",
      `${qty} ${selectedItem.uom} of ${selectedItem.name} added`,
      "success"
    );

    setSelectedItem(null);
    setQuantityInput("");
  };

  // Complete current box and start new one
  const handleCompleteBox = () => {
    const currentBox = getCurrentBox();
    if (!currentBox || currentBox.contents.length === 0) {
      showToast("Box Empty", "Add items before completing box", "warning");
      return;
    }

    if (packingOrder) {
      const newBox = addBox(packingOrder);
      const updatedOrder = { ...packingOrder, boxes: [...packingOrder.boxes, newBox] };
      setPackingOrder(updatedOrder);
      setCurrentBoxId(newBox.boxId);
      saveSessionOrder(updatedOrder);

      showToast(
        "Box Completed",
        `${currentBox.boxId} completed with ${currentBox.totalItems} items. Starting ${newBox.boxId}`,
        "success"
      );
    }
  };

  // Undo last item
  const handleUndoLastItem = () => {
    const currentBox = getCurrentBox();
    if (!currentBox || currentBox.contents.length === 0) {
      showToast("No Items", "Nothing to undo", "warning");
      return;
    }

    const lastContent = currentBox.contents[currentBox.contents.length - 1];
    
    // Save to redo stack
    setRedoStack([...redoStack, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    
    // Remove last item
    currentBox.contents.pop();
    currentBox.totalItems -= lastContent.quantityPacked;

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      setPackingOrder(updatedOrder);
      saveSessionOrder(updatedOrder);
    }

    showToast(
      "Item Removed",
      `Removed ${lastContent.quantityPacked} ${lastContent.uom} of ${lastContent.itemName}`,
      "info"
    );
  };

  // Redo last undo
  const handleRedoLastItem = () => {
    if (redoStack.length === 0) {
      showToast("No Items", "Nothing to redo", "warning");
      return;
    }

    const lastRedo = redoStack[redoStack.length - 1];
    const currentBox = packingOrder?.boxes.find((b) => b.boxId === lastRedo.boxId);

    if (!currentBox) {
      showToast("Error", "Box not found", "warning");
      return;
    }

    currentBox.contents = lastRedo.contents;
    currentBox.totalItems = lastRedo.contents.reduce((sum, c) => sum + c.quantityPacked, 0);

    const updatedRedoStack = redoStack.slice(0, -1);
    setRedoStack(updatedRedoStack);

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      setPackingOrder(updatedOrder);
      saveSessionOrder(updatedOrder);
    }

    showToast("Item Restored", "Last undo reversed", "success");
  };

  // Remove specific item from box
  const handleRemoveItemFromBox = (itemIndex: number) => {
    const currentBox = getCurrentBox();
    if (!currentBox) return;

    setHistory([...history, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    setRedoStack([]);

    const removed = currentBox.contents[itemIndex];
    currentBox.contents.splice(itemIndex, 1);
    currentBox.totalItems -= removed.quantityPacked;

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      setPackingOrder(updatedOrder);
      saveSessionOrder(updatedOrder);
    }

    showToast("Item Removed", `${removed.itemName} removed from box`, "info");
  };

  // Handle barcode scanning
  const handleScan = (value: string) => {
    const scanned = value.trim().toLowerCase();

    if (!scanned) return;

    const currentBox = getCurrentBox();
    if (!currentBox) {
      showToast("Error", "No active box selected", "warning");
      return;
    }

    const foundItem = packingOrder?.items.find(
      (item) => item.sku.toLowerCase() === scanned
    );

    if (!foundItem) {
      showToast("❌ Not Found", `SKU "${value}" not in this order`, "warning");
      setScanInput("");
      return;
    }

    const remaining = getRemainingQty(foundItem);

    if (remaining <= 0) {
      showToast("✓ Complete", `${foundItem.sku} already fully packed`, "info");
      setScanInput("");
      return;
    }

    // Check if item already exists in current box
    const existingItemIndex = currentBox.contents.findIndex(
      (c) => c.itemSku === foundItem.sku
    );

    // Save to history for undo
    setHistory([...history, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    setRedoStack([]);

    if (existingItemIndex >= 0) {
      // Item exists - increment quantity
      const existingItem = currentBox.contents[existingItemIndex];
      existingItem.quantityPacked += 1;
      currentBox.totalItems += 1;
    } else {
      // New item - add it
      const content: BoxContent = {
        itemSku: foundItem.sku,
        itemName: foundItem.name,
        packType: foundItem.packType,
        quantityPacked: 1,
        quantityRequired: foundItem.quantity,
        uom: foundItem.uom,
        timestamp: new Date().toISOString(),
      };
      currentBox.contents.push(content);
      currentBox.totalItems += 1;
    }

    if (packingOrder) {
      const updatedOrder = { ...packingOrder };
      setPackingOrder(updatedOrder);
      saveSessionOrder(updatedOrder);
    }

    showToast(
      "✓ Scanned",
      `${foundItem.sku} | ${remaining - 1} ${foundItem.uom} remaining`,
      "success"
    );

    setScanInput("");
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

    const completedOrder = {
      ...packingOrder,
      status: "completed" as const,
      completedAt: new Date().toISOString(),
    };

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
      showToast("Excel Exported", "Packing list saved to Excel", "success");
    } catch (error) {
      showToast("Export Failed", String(error), "warning");
    } finally {
      setIsExporting(false);
    }
  };

  if (!packingOrder || !currentBoxId) {
    return (
      <ProtectedPage>
        <div className="container">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "400px",
            }}
          >
            <p style={{ fontSize: "18px", color: "#6b7280" }}>
              Loading packing order...
            </p>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const currentBox = getCurrentBox();
  const incompleteness = validatePackingComplete(packingOrder);
  const completionPercent = Math.round(
    (packingOrder.boxes.reduce((sum, b) => sum + b.totalItems, 0) /
      packingOrder.items.reduce((sum, i) => sum + i.quantity, 0)) *
    100
  );

  return (
    <ProtectedPage>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes scanPulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .packing-card {
          animation: slideIn 0.3s ease-out;
        }
        .progress-bar {
          transition: width 0.4s ease;
        }
        .box-selector {
          transition: all 0.3s ease;
        }
        .box-selector:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .box-selector.active {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .scanner-input:focus {
          animation: scanPulse 1.5s infinite;
        }
        @media (max-width: 768px) {
          .sidebar-right {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            border-left: none !important;
            border-top: 1px solid #e5e7eb !important;
            margin-top: 20px;
          }
        }
        @media (max-width: 1024px) {
          .packing-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="container">
        <PageHeader
          title="Packing Order"
          subtitle={`Order: ${packingOrder.orderId} | Client: ${packingOrder.clientName}`}
          showBack={true}
          showLogout={true}
        />

        {/* Main Layout Grid */}
        <div
          className="packing-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "24px",
          }}
        >
          {/* Main Content Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Progress Card */}
            <div className="card packing-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "18px" }}>📊 Packing Progress</h3>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "700",
                    color:
                      completionPercent === 100 ? "#10b981" : "#3b82f6",
                  }}
                >
                  {completionPercent}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "32px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "16px",
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                <div
                  className="progress-bar"
                  style={{
                    width: `${completionPercent}%`,
                    height: "100%",
                    backgroundColor:
                      completionPercent === 100 ? "#10b981" : "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: "700",
                  }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "16px",
                  fontSize: "13px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", color: "#6b7280", fontSize: "11px" }}>
                    Boxes
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "#0f172a",
                    }}
                  >
                    {packingOrder.boxes.length}
                  </p>
                </div>
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", color: "#6b7280", fontSize: "11px" }}>
                    Items Packed
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#0f172a",
                    }}
                  >
                    {packingOrder.boxes.reduce((sum, b) => sum + b.totalItems, 0)}/
                    {packingOrder.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </p>
                </div>
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", color: "#6b7280", fontSize: "11px" }}>
                    Status
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: "700",
                      color: completionPercent === 100 ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {completionPercent === 100 ? "✓ Done" : "In Progress"}
                  </p>
                </div>
              </div>
            </div>

            {/* Barcode Scanner Section */}
            <div className="card packing-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", flex: 1 }}>📱 Barcode Scanner</h3>
                <span
                  style={{
                    fontSize: "20px",
                    color: scanInput ? "#10b981" : "#9ca3af",
                    animation: scanInput ? "pulse 1s infinite" : "none",
                  }}
                >
                  ●
                </span>
              </div>
              <input
                ref={(input) => input?.focus()}
                type="text"
                placeholder="Scan barcode or type SKU... (auto-focus)"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleScan(scanInput);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "2px solid #3b82f6",
                  borderRadius: "10px",
                  backgroundColor: "#eff6ff",
                  fontSize: "15px",
                  fontWeight: "500",
                  color: "#0f172a",
                  transition: "all 0.3s ease",
                  boxShadow: scanInput ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
                  outline: "none",
                }}
              />
              <p
                style={{
                  margin: "12px 0 0 0",
                  fontSize: "11px",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>💡</span> Press Enter or let scanner auto-send to add item instantly
              </p>
            </div>

            {/* Box Selector */}
            <div className="card packing-card">
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>📦 Select Box</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                  gap: "10px",
                  maxHeight: "140px",
                  overflowY: "auto",
                  paddingRight: "8px",
                }}
              >
                {packingOrder.boxes.map((box) => (
                  <button
                    key={box.boxId}
                    className="box-selector"
                    onClick={() => setCurrentBoxId(box.boxId)}
                    style={{
                      padding: "14px 10px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      backgroundColor: "#f9fafb",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      textAlign: "center",
                      transition: "all 0.3s ease",
                      ...(currentBoxId === box.boxId && {
                        borderColor: "#2563eb",
                        backgroundColor: "#eff6ff",
                        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
                      }),
                    }}
                  >
                    <div style={{ fontSize: "13px" }}>{box.boxId}</div>
                    <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px" }}>
                      {box.totalItems} items
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Box Contents */}
            {currentBox && (
              <div className="card packing-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "16px" }}>
                    📭 Box: <span style={{ color: "#2563eb" }}>{currentBox.boxId}</span>
                  </h3>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#fff",
                      backgroundColor: "#3b82f6",
                      padding: "6px 14px",
                      borderRadius: "20px",
                    }}
                  >
                    {currentBox.totalItems} items
                  </span>
                </div>

                {currentBox.contents.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      maxHeight: "320px",
                      overflowY: "auto",
                    }}
                  >
                    {currentBox.contents.map((content, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px",
                          backgroundColor: "#f9fafb",
                          borderRadius: "10px",
                          borderLeft: "4px solid #3b82f6",
                          animation: "slideIn 0.3s ease-out",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: "0 0 4px 0",
                              fontWeight: "600",
                              fontSize: "13px",
                              color: "#0f172a",
                            }}
                          >
                            {content.itemSku}
                          </p>
                          <p
                            style={{
                              margin: "0 0 4px 0",
                              fontSize: "12px",
                              color: "#6b7280",
                            }}
                          >
                            {content.itemName}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "11px",
                              color: "#9ca3af",
                            }}
                          >
                            {content.quantityPacked} {content.uom}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItemFromBox(idx)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#fee2e2",
                            color: "#991b1b",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            marginLeft: "10px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              "#fecaca";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              "#fee2e2";
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      color: "#9ca3af",
                    }}
                  >
                    <p style={{ fontSize: "14px", margin: 0 }}>
                      No items in this box yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Add Item Section */}
            <div className="card packing-card">
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>➕ Add Item to Box</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "12px", marginBottom: "6px" }}>
                    Select Item *
                  </label>
                  <select
                    value={selectedItem?.sku || ""}
                    onChange={(e) => {
                      const item = packingOrder.items.find((i) => i.sku === e.target.value);
                      setSelectedItem(item || null);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "2px solid #cbd5e1",
                      borderRadius: "8px",
                      backgroundColor: "#f8fafc",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Choose item...</option>
                    {packingOrder.items.map((item) => {
                      const remaining = getRemainingQty(item);
                      return (
                        <option
                          key={item.sku}
                          value={item.sku}
                          disabled={remaining <= 0}
                        >
                          {item.sku} ({remaining} left)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "12px", marginBottom: "6px" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    min="1"
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "2px solid #cbd5e1",
                      borderRadius: "8px",
                      backgroundColor: "#f8fafc",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {selectedItem && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#dbeafe",
                    border: "1px solid #93c5fd",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "12px",
                    animation: "slideIn 0.3s ease-out",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", fontWeight: "600", color: "#1e40af" }}>
                    {selectedItem.name}
                  </p>
                  <p style={{ margin: "0 0 4px 0", color: "#1e40af" }}>
                    Type: {selectedItem.packType}
                  </p>
                  <p style={{ margin: 0, color: "#1e40af", fontWeight: "700" }}>
                    Remaining: {getRemainingQty(selectedItem)} {selectedItem.uom}
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "12px",
                }}
              >
                <button
                  className="primary-button"
                  onClick={handleAddItemToBox}
                  disabled={!selectedItem || !quantityInput}
                  style={{ width: "100%", fontSize: "14px" }}
                >
                  ✓ Add Item
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="button-group packing-card"
              style={{
                gap: "12px",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
              }}
            >
              <button
                className="primary-button"
                onClick={handleCompleteBox}
                disabled={!currentBox || currentBox.contents.length === 0}
                style={{ fontSize: "13px" }}
              >
                ✓ Complete Box
              </button>
              <button
                className="second-button"
                onClick={handleUndoLastItem}
                disabled={!currentBox || currentBox.contents.length === 0}
                style={{ fontSize: "13px" }}
              >
                ↶ Undo
              </button>
              <button
                className="second-button"
                onClick={handleRedoLastItem}
                disabled={redoStack.length === 0}
                style={{ fontSize: "13px" }}
              >
                ↷ Redo
              </button>
              <button
                className="primary-button"
                onClick={handleFinishPacking}
                disabled={incompleteness.missing.length > 0}
                style={{ backgroundColor: "#10b981", fontSize: "13px" }}
              >
                ✓ Finish
              </button>
            </div>
          </div>

          {/* Sidebar - Right Column */}
          <div className="sidebar-right" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Item Status */}
            <div className="card packing-card">
              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700" }}>
                📋 Item Status
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "450px",
                  overflowY: "auto",
                  paddingRight: "6px",
                }}
              >
                {packingOrder.items.map((item) => {
                  let totalPacked = 0;
                  for (const box of packingOrder.boxes) {
                    totalPacked += box.contents
                      .filter((c) => c.itemSku === item.sku)
                      .reduce((sum, c) => sum + c.quantityPacked, 0);
                  }
                  const remaining = item.quantity - totalPacked;
                  const isComplete = remaining === 0;

                  return (
                    <div
                      key={item.sku}
                      style={{
                        padding: "10px",
                        backgroundColor: isComplete ? "#dcfce7" : "#f9fafb",
                        borderRadius: "8px",
                        borderLeft: `4px solid ${isComplete ? "#10b981" : "#3b82f6"}`,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        {item.sku}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "4px",
                        }}
                      >
                        <span>
                          {totalPacked}/{item.quantity}
                        </span>
                        <span>{isComplete ? "✓" : `${remaining}L`}</span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "4px",
                          backgroundColor: "#e5e7eb",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(totalPacked / item.quantity) * 100}%`,
                            height: "100%",
                            backgroundColor: isComplete ? "#10b981" : "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Statistics */}
            <div className="card packing-card">
              <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "700" }}>
                📈 Stats
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Total Boxes:</span>
                  <strong style={{ color: "#0f172a" }}>{packingOrder.boxes.length}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Current Box:</span>
                  <strong style={{ color: "#0f172a" }}>{currentBox?.totalItems || 0}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Completion:</span>
                  <strong
                    style={{
                      color: completionPercent === 100 ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {completionPercent}%
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationModal
        open={!!notification}
        title={notification?.title ?? ""}
        message={notification?.message ?? ""}
        type={notification?.type ?? "info"}
        onClose={() => setNotification(null)}
      />
    </ProtectedPage>
  );
}
