"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../../components/ProtectedPage";
import PageHeader from "../../components/PageHeader";
import NotificationModal from "../../components/NotificationModal";
import {
  addBox,
  addItemToBox,
  validatePackingComplete,
  savePackingRecord,
  createPallet,
  addBoxToPallet,
  removeBoxFromPallet,
  renameBox,
  renamePallet,
  recalculatePalletTotals,
  removeItemFromBox,
  getPalletSummary,
  type PackingOrder,
  type Box,
  type PackingItem,
  type BoxContent,
  type Pallet,
} from "../../lib/packingManagement";
import { useToast } from "../../components/ToastProvider";
import { generatePackingListPDF, exportPackingListExcel } from "../../lib/packingExport";

export default function PackingPage() {
  const router = useRouter();

  // State
  const [packingOrder, setPackingOrder] = useState<PackingOrder | null>(null);
  const [currentBoxId, setCurrentBoxId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PackingItem | null>(null);
  const [highlightSku, setHighlightSku] = useState<string | null>(null);
  const [multiSelectSkus, setMultiSelectSkus] = useState<Set<string>>(new Set());
  const [multiSelectQty, setMultiSelectQty] = useState<Record<string, number>>({});
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editingBoxName, setEditingBoxName] = useState("");
  const [editingPalletId, setEditingPalletId] = useState<string | null>(null);
  const [editingPalletName, setEditingPalletName] = useState("");
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [showPalletModal, setShowPalletModal] = useState(false);
  const highlightTimerRef = useRef<number | null>(null);
  const itemsSelectRef = useRef<HTMLSelectElement | null>(null);
  const statusListRef = useRef<HTMLDivElement | null>(null);
  const HIGHLIGHT_MS = 2500;

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  // When highlightSku changes, scroll that item into view and focus the select
  useEffect(() => {
    if (highlightSku) {
      // scroll status item into view
      const el = document.getElementById(`status-item-${highlightSku}`);
      if (el) {
         el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (statusListRef.current) {
        // fallback: scroll container to top
         statusListRef.current.scrollTop = 0;
      }

      // focus the main select so user can quickly change qty
      if (itemsSelectRef.current) {
        try {
          // itemsSelectRef.current.focus();
        } catch (e) {
          /* ignore */
        }
      }
    }
  }, [highlightSku]);
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

  // Multi-select handlers
  const toggleMultiSelect = (sku: string) => {
    const newSet = new Set(multiSelectSkus);
    if (newSet.has(sku)) {
      newSet.delete(sku);
      const newQty = { ...multiSelectQty };
      delete newQty[sku];
      setMultiSelectQty(newQty);
    } else {
      newSet.add(sku);
      setMultiSelectQty({ ...multiSelectQty, [sku]: 1 });
    }
    setMultiSelectSkus(newSet);
  };

  // Pack all selected items at once
  const handlePackAllSelected = () => {
    if (multiSelectSkus.size === 0) {
      showToast("Selection Empty", "Select items to pack", "warning");
      return;
    }

    if (!packingOrder) return;
    const currentBox = getCurrentBox();
    if (!currentBox) {
      showToast("Error", "No active box selected", "warning");
      return;
    }

    setHistory([...history, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    setRedoStack([]);

    let packedCount = 0;
    let errors: string[] = [];

    for (const sku of Array.from(multiSelectSkus)) {
      const qty = multiSelectQty[sku] || 1;
      const item = packingOrder.items.find((i) => i.sku === sku);
      if (!item) {
        errors.push(`${sku} not found`);
        continue;
      }

      const remaining = getRemainingQty(item);
      if (qty > remaining) {
        errors.push(`${sku}: only ${remaining} left`);
        continue;
      }

      // Check if item already in current box
      const existingIdx = currentBox.contents.findIndex((c) => c.itemSku === sku);
      if (existingIdx >= 0) {
        currentBox.contents[existingIdx].quantityPacked += qty;
      } else {
        currentBox.contents.push({
          itemSku: item.sku,
          itemName: item.name,
          packType: item.packType,
          quantityPacked: qty,
          quantityRequired: item.quantity,
          uom: item.uom,
          timestamp: new Date().toISOString(),
        });
      }
      currentBox.totalItems += qty;
      packedCount++;
    }

    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);

    showToast(
      "✓ Packed",
      `${packedCount} item(s) added${errors.length > 0 ? ` (${errors.length} skipped)` : ""}`,
      packedCount > 0 ? "success" : "warning"
    );

    setMultiSelectSkus(new Set());
    setMultiSelectQty({});
  };

  // Mark item status (packed, master box, backed elsewhere)
  const markItemStatus = (sku: string, status: "packed" | "master_box" | "backed_elsewhere") => {
    if (!packingOrder) return;
    const updatedItems = packingOrder.items.map((item) =>
      item.sku === sku ? { ...item, itemStatus: status } : item
    );
    const updatedOrder = { ...packingOrder, items: updatedItems };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    showToast("Status Updated", `${sku} marked as ${status.replace(/_/g, " ")}`, "success");
  };

  // Pallet management handlers
  const handleCreatePallet = () => {
    if (!packingOrder) return;
    if (!packingOrder.pallets) packingOrder.pallets = [];

    const newPallet = createPallet(packingOrder);
    packingOrder.pallets.push(newPallet);
    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    setSelectedPalletId(newPallet.palletId);
    showToast("✓ Pallet Created", `${newPallet.palletId}`, "success");
  };

  const handleAddBoxToPallet = (palletId: string, boxId: string) => {
    if (!packingOrder || !packingOrder.pallets) return;
    addBoxToPallet(packingOrder, palletId, boxId);
    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    showToast("✓ Box Assigned", `${boxId} → ${palletId}`, "success");
  };

  const handleRemoveBoxFromPallet = (palletId: string, boxId: string) => {
    if (!packingOrder || !packingOrder.pallets) return;
    removeBoxFromPallet(packingOrder, palletId, boxId);
    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    showToast("✓ Box Removed", `${boxId} removed from ${palletId}`, "success");
  };

  const handleRenameBox = (boxId: string) => {
    if (!packingOrder || !editingBoxName.trim()) {
      showToast("Validation Error", "Enter a box name", "warning");
      return;
    }
    renameBox(packingOrder, boxId, editingBoxName);
    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    showToast("✓ Box Renamed", `${boxId} → ${editingBoxName}`, "success");
    setEditingBoxId(null);
    setEditingBoxName("");
  };

  const handleRenamePallet = (palletId: string) => {
    if (!packingOrder || !editingPalletName.trim()) {
      showToast("Validation Error", "Enter a pallet name", "warning");
      return;
    }
    renamePallet(packingOrder, palletId, editingPalletName);
    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);
    showToast("✓ Pallet Renamed", `${palletId} → ${editingPalletName}`, "success");
    setEditingPalletId(null);
    setEditingPalletName("");
  };

  const getBoxDisplayName = (box: Box): string => {
    return box.customName || box.boxId;
  };

  const getPalletDisplayName = (pallet: Pallet): string => {
    return pallet.customName || pallet.palletId;
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

    // Add to current box (pass packingOrder to update pallet totals)
    const content = addItemToBox(currentBox, selectedItem, qty, packingOrder);

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
    if (!currentBox || !packingOrder) return;

    setHistory([...history, { boxId: currentBox.boxId, contents: [...currentBox.contents] }]);
    setRedoStack([]);

    const removed = currentBox.contents[itemIndex];
    
    // Use the new function that updates pallet totals
    removeItemFromBox(currentBox, itemIndex, packingOrder);

    const updatedOrder = { ...packingOrder };
    setPackingOrder(updatedOrder);
    saveSessionOrder(updatedOrder);

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

    // Move scanned item to top of the items list and highlight it for review
    try {
      if (packingOrder) {
        const reordered = [
          foundItem,
          ...packingOrder.items.filter((i) => i.sku !== foundItem.sku),
        ];
        const updatedOrder = { ...packingOrder, items: reordered };
        setPackingOrder(updatedOrder);
        saveSessionOrder(updatedOrder);
        setSelectedItem(foundItem);
        // trigger highlight animation on sidebar and auto-scroll/focus
        if (highlightTimerRef.current) {
          window.clearTimeout(highlightTimerRef.current);
        }
        setHighlightSku(foundItem.sku);
        // auto-focus select (so user can adjust qty) and scroll status into view via effect
        // clear highlight after configured duration
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightSku(null);
          highlightTimerRef.current = null;
        }, HIGHLIGHT_MS) as unknown as number;
      }
    } catch (e) {
      console.error("Failed to reorder items after scan:", e);
    }

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

  // Order the status items so the selected/scanned item appears first
  const statusItems = selectedItem
    ? [selectedItem, ...packingOrder.items.filter((i) => i.sku !== selectedItem.sku)]
    : packingOrder.items;

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
        @keyframes highlightGlow {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.25); transform: translateY(0); }
          50% { box-shadow: 0 8px 30px rgba(59,130,246,0.12); transform: translateY(-2px); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); transform: translateY(0); }
        }
        .status-highlight {
          animation: highlightGlow 1.6s ease-out;
          border-left-color: #2563eb !important;
          background: linear-gradient(90deg, rgba(239,246,255,0.9), rgba(249,250,251,0.9));
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
                // ref={(input) => input?.click()}
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
                    <div style={{ fontSize: "13px" }}>{getBoxDisplayName(box)}</div>
                    <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px" }}>
                      {box.totalItems} items
                    </div>
                    {box.palletId && (
                      <div style={{ fontSize: "9px", color: "#059669", marginTop: "3px", fontWeight: "600" }}>
                        📋 {box.palletId}
                      </div>
                    )}
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
                    ref={itemsSelectRef}
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
                onClick={() => setEditingBoxId(currentBoxId)}
                disabled={!currentBoxId}
                style={{ fontSize: "13px" }}
              >
                ✎ Rename Box
              </button>
              <button
                className="second-button"
                onClick={() => setShowPalletModal(true)}
                disabled={!currentBoxId || !packingOrder?.pallets?.length}
                style={{ fontSize: "13px" }}
              >
                📋 Assign to Pallet
              </button>
              <button
                className="second-button"
                onClick={handleCreatePallet}
                style={{ fontSize: "13px" }}
              >
                ➕ New Pallet
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
            {/* Now Packing Banner */}
            {selectedItem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }} />
                <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                  <strong style={{ color: '#1e3a8a' }}>Now packing</strong>
                  <div style={{ fontSize: 12, color: '#0f172a' }}>{selectedItem.sku} — {selectedItem.name}</div>
                </div>
                <button onClick={() => { setSelectedItem(null); setHighlightSku(null); }} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#f3f4f6', cursor: 'pointer' }}>Clear</button>
              </div>
            )}
            {/* Item Status */}
            <div className="card packing-card">
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700" }}>
                📋 Item Status
              </h4>
              {multiSelectSkus.size > 0 && (
                <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#dbeafe", borderRadius: "8px", border: "1px solid #93c5fd" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#1e40af" }}>
                      Selected: {multiSelectSkus.size}
                    </span>
                    <button
                      onClick={handlePackAllSelected}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      📦 Pack All
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    {Array.from(multiSelectSkus).map((sku) => (
                      <div key={sku} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <input
                          type="number"
                          min="1"
                          value={multiSelectQty[sku] || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setMultiSelectQty({ ...multiSelectQty, [sku]: Math.max(1, val) });
                          }}
                          style={{
                            width: "50px",
                            padding: "4px",
                            border: "1px solid #93c5fd",
                            borderRadius: "4px",
                            fontSize: "11px",
                          }}
                        />
                        <span style={{ fontSize: "11px", fontWeight: "600" }}>{sku}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  paddingRight: "6px",
                }}
                ref={statusListRef}
              >
                {statusItems.map((item) => {
                  let totalPacked = 0;
                  for (const box of packingOrder.boxes) {
                    totalPacked += box.contents
                      .filter((c) => c.itemSku === item.sku)
                      .reduce((sum, c) => sum + c.quantityPacked, 0);
                  }
                  const remaining = item.quantity - totalPacked;
                  const isComplete = remaining === 0;
                  const isSelected = selectedItem?.sku === item.sku;
                  const isMultiSelected = multiSelectSkus.has(item.sku);
                  const status = item.itemStatus || "packed";

                  return (
                    <div
                      id={`status-item-${item.sku}`}
                      key={item.sku}
                      className={item.sku === highlightSku ? "status-highlight" : ""}
                      style={{
                        padding: "10px",
                        backgroundColor: isMultiSelected ? "#dbeafe" : isSelected ? "#e6f0ff" : isComplete ? "#dcfce7" : "#f9fafb",
                        borderRadius: "8px",
                        borderLeft: `4px solid ${isComplete ? "#10b981" : isMultiSelected ? "#2563eb" : "#3b82f6"}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <input
                          type="checkbox"
                          checked={isMultiSelected}
                          onChange={() => toggleMultiSelect(item.sku)}
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0", fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
                            {item.sku}
                          </p>
                          <p style={{ margin: "0", fontSize: "10px", color: "#6b7280" }}>
                            {item.name.substring(0, 30)}
                            {item.name.length > 30 ? "..." : ""}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "6px",
                        }}
                      >
                        <span>
                          {totalPacked}/{item.quantity}
                        </span>
                        <span>{isComplete ? "✓ Done" : `${remaining}L`}</span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "3px",
                          backgroundColor: "#e5e7eb",
                          borderRadius: "2px",
                          overflow: "hidden",
                          marginBottom: "8px",
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
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => markItemStatus(item.sku, "packed")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "10px",
                            backgroundColor: status === "packed" ? "#2563eb" : "#f3f4f6",
                            color: status === "packed" ? "white" : "#6b7280",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "600",
                          }}
                        >
                          📦 Box
                        </button>
                        <button
                          onClick={() => markItemStatus(item.sku, "master_box")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "10px",
                            backgroundColor: status === "master_box" ? "#f59e0b" : "#f3f4f6",
                            color: status === "master_box" ? "white" : "#6b7280",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "600",
                          }}
                        >
                          👑 Master
                        </button>
                        <button
                          onClick={() => markItemStatus(item.sku, "backed_elsewhere")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "10px",
                            backgroundColor: status === "backed_elsewhere" ? "#ef4444" : "#f3f4f6",
                            color: status === "backed_elsewhere" ? "white" : "#6b7280",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "600",
                          }}
                        >
                          🔄 Elsewhere
                        </button>
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

      {/* Edit Box Name Modal */}
      {editingBoxId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingBoxId(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
              📝 Rename Box
            </h2>
            <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "14px" }}>
              Current: <strong>{editingBoxId}</strong>
            </p>
            <input
              type="text"
              placeholder="Enter box name (e.g., Special Order, Client A)"
              value={editingBoxName}
              onChange={(e) => setEditingBoxName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleRenameBox(editingBoxId)}
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => handleRenameBox(editingBoxId)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ✓ Rename
              </button>
              <button
                onClick={() => setEditingBoxId(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#e5e7eb",
                  color: "#6b7280",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pallet Name Modal */}
      {editingPalletId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingPalletId(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
              📋 Rename Pallet
            </h2>
            <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "14px" }}>
              Current: <strong>{editingPalletId}</strong>
            </p>
            <input
              type="text"
              placeholder="Enter pallet name (e.g., Urgent Order, Customer XYZ)"
              value={editingPalletName}
              onChange={(e) => setEditingPalletName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleRenamePallet(editingPalletId)}
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => handleRenamePallet(editingPalletId)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ✓ Rename
              </button>
              <button
                onClick={() => setEditingPalletId(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#e5e7eb",
                  color: "#6b7280",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Pallet Modal */}
      {showPalletModal && packingOrder?.pallets && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowPalletModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
              📋 Assign Box to Pallet
            </h2>
            <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "14px" }}>
              Box: <strong>{currentBoxId}</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
              {packingOrder.pallets.map((pallet) => (
                <div
                  key={pallet.palletId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>{pallet.palletId}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      {pallet.totalBoxes} boxes, {pallet.totalItems} items
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleAddBoxToPallet(pallet.palletId, currentBoxId!);
                      setShowPalletModal(false);
                    }}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPalletModal(false)}
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "16px",
                backgroundColor: "#e5e7eb",
                color: "#6b7280",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pallet Overview Section */}
      {packingOrder?.pallets && packingOrder.pallets.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "16px",
            maxWidth: "320px",
            maxHeight: "400px",
            overflowY: "auto",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700" }}>
            📦 Pallets ({packingOrder.pallets.length})
          </h3>
          {packingOrder.pallets.map((pallet) => (
            <div
              key={pallet.palletId}
              style={{
                padding: "10px",
                backgroundColor: "#f9fafb",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "6px" }}>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>
                    {getPalletDisplayName(pallet)}
                  </div>
                  <div style={{ color: "#6b7280", marginTop: "2px" }}>
                    📦 {pallet.totalBoxes} | 📊 {pallet.totalItems}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingPalletId(pallet.palletId);
                    setEditingPalletName(pallet.customName || "");
                  }}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "#dbeafe",
                    color: "#0369a1",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "600",
                  }}
                  title="Rename pallet"
                >
                  ✎
                </button>
              </div>
            </div>
          ))}
          {packingOrder.boxes.filter((b) => !b.palletId).length > 0 && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#fef3c7",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#78350f",
              }}
            >
              ⚠️ {packingOrder.boxes.filter((b) => !b.palletId).length} unassigned box(es)
            </div>
          )}
        </div>
      )}

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
