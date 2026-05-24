"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedPage from "../../components/ProtectedPage";
import PageHeader from "../../components/PageHeader";
import NotificationModal from "../../components/NotificationModal";
import {
  createPackingOrder,
  generateBoxId,
  type PackingItem,
  type BoxIdType,
  parsePackingListExcel,
} from "../../lib/packingManagement";

export default function NewPackingOrderPage() {
  const router = useRouter();

  // Form state
  const [orderId, setOrderId] = useState("");
  const [clientName, setClientName] = useState("");
  const [boxIdType, setBoxIdType] = useState<BoxIdType>("generated");
  const [useItemNumbers, setUseItemNumbers] = useState(false);

  // Items state
  const [items, setItems] = useState<PackingItem[]>([]);
  const [itemInput, setItemInput] = useState({
    sku: "",
    name: "",
    packType: "pack_unit" as "pack_unit" | "pack_l1",
    quantity: "",
    uom: "PCS",
  });

  // File upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // UI state
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: "warning" | "success" | "info";
  } | null>(null);

  const openNotification = (
    title: string,
    message: string,
    type: "warning" | "success" | "info" = "info"
  ) => {
    setNotification({ title, message, type });
  };

  // Add manual item
  const handleAddItem = () => {
    if (!itemInput.sku.trim() || !itemInput.name.trim() || !itemInput.quantity) {
      openNotification("Validation Error", "Fill all item fields", "warning");
      return;
    }

    const newItem: PackingItem = {
      sku: itemInput.sku.trim(),
      name: itemInput.name.trim(),
      packType: itemInput.packType,
      quantity: parseInt(itemInput.quantity, 10),
      uom: itemInput.uom,
    };

    setItems([...items, newItem]);
    setItemInput({
      sku: "",
      name: "",
      packType: "pack_unit",
      quantity: "",
      uom: "PCS",
    });
    openNotification("Item Added", `${newItem.name} added to list`, "success");
  };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploadFile(file);
  setIsParsingFile(true);

  try {
    const parsedItems = await parsePackingListExcel(file);

    // 🔥 Normalize + add packedQty
    const normalized = parsedItems.map(item => ({
      ...item,
      packedQty: 0,
    }));

    setItems(normalized);

    openNotification(
      "File Loaded",
      `Loaded ${normalized.length} items`,
      "success"
    );

  } catch (error: any) {
    console.error(error);

    openNotification(
      "Parse Error",
      error.message || "Failed to parse file",
      "warning"
    );
  } finally {
    setIsParsingFile(false);
  }
};

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Start packing
  const handleStartPacking = () => {
  if (!orderId.trim()) {
    openNotification("Validation Error", "Enter Order ID", "warning");
    return;
  }

  if (!clientName.trim()) {
    openNotification("Validation Error", "Enter Client Name", "warning");
    return;
  }

  if (items.length === 0) {
    openNotification("Validation Error", "Add at least one item", "warning");
    return;
  }

  // Create packing order with ALL items (both pack_unit and pack_l1)
  // Each item will be handled during packing based on its packType
  const packingOrder = createPackingOrder(
    orderId.trim(),
    clientName.trim(),
    items,
    boxIdType
  );

  // Save and navigate
  sessionStorage.setItem("current_packing_order", JSON.stringify(packingOrder));

  router.push("/packing/pack");
};

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="New Packing Order"
          subtitle="Set up order details and items for packing"
          showBack={true}
          showLogout={true}
        />

        {/* Order Details */}
        <div className="card">
          <h3>Order Information</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div className="form-field">
              <label htmlFor="order-id">Order ID *</label>
              <input
                id="order-id"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g., ORD-2024-001"
              />
            </div>

            <div className="form-field">
              <label htmlFor="client-name">Client Name *</label>
              <input
                id="client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., ABC Company"
              />
            </div>

            <div className="form-field">
              <label htmlFor="box-id-type">Box Identification</label>
              <select
                id="box-id-type"
                value={boxIdType}
                onChange={(e) => setBoxIdType(e.target.value as BoxIdType)}
              >
                <option value="generated">
                  Generated ID (e.g.,{" "}
                  {generateBoxId(clientName || "ABC", 1)})
                </option>
                <option value="number">Box Number (Box 1, Box 2, ...)</option>
              </select>
            </div>

            <div className="form-field">
              <label>
                <input
                  type="checkbox"
                  checked={useItemNumbers}
                  onChange={(e) => setUseItemNumbers(e.target.checked)}
                  style={{ marginRight: "8px" }}
                />
                Track Item Numbers
              </label>
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                System will warn if quantity exceeds order
              </p>
            </div>
          </div>
        </div>

        {/* Items Input */}
        <div className="card">
          <h3>Packing Items</h3>

          {/* Upload Excel */}
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
            }}
          >
            <label htmlFor="file-upload" style={{ display: "block", marginBottom: "12px" }}>
              <strong>Upload Packing List (Excel or CSV)</strong>
            </label>
            <p style={{ fontSize: "12px", color: "#059669", marginBottom: "12px" }}>
              Format: SKU,Name,PackType,Quantity,UOM (pack_unit or pack_l1)
            </p>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={handleFileUpload}
              disabled={isParsingFile}
              style={{
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                width: "100%",
              }}
            />
            {uploadFile && (
              <p style={{ fontSize: "12px", color: "#059669", marginTop: "8px" }}>
                ✓ File: {uploadFile.name}
              </p>
            )}
          </div>

          {/* Manual Item Entry */}
          {items.length < 50 && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
              }}
            >
              <p style={{ marginBottom: "12px", fontWeight: "600" }}>
                Or Add Items Manually
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 2fr 1fr 1fr auto",
                  gap: "8px",
                  alignItems: "end",
                }}
              >
                <input
                  type="text"
                  placeholder="SKU"
                  value={itemInput.sku}
                  onChange={(e) =>
                    setItemInput({ ...itemInput, sku: e.target.value })
                  }
                  style={{
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Item Name"
                  value={itemInput.name}
                  onChange={(e) =>
                    setItemInput({ ...itemInput, name: e.target.value })
                  }
                  style={{
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                  }}
                />
                <select
                  value={itemInput.packType}
                  onChange={(e) =>
                    setItemInput({
                      ...itemInput,
                      packType: e.target.value as "pack_unit" | "pack_l1",
                    })
                  }
                  style={{
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                  }}
                >
                  <option value="pack_unit">Pack Unit</option>
                  <option value="pack_l1">Pack L1</option>
                </select>
                <input
                  type="number"
                  placeholder="Qty"
                  value={itemInput.quantity}
                  onChange={(e) =>
                    setItemInput({ ...itemInput, quantity: e.target.value })
                  }
                  style={{
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                  }}
                />
                <button className="primary-button" onClick={handleAddItem}>
                  Add Item
                </button>
              </div>
            </div>
          )}

          {/* Items List */}
          {items.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                marginBottom: "20px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "10px", textAlign: "left" }}>SKU</th>
                    <th style={{ padding: "10px", textAlign: "left" }}>Name</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>
                      Pack Type
                    </th>
                    <th style={{ padding: "10px", textAlign: "right" }}>
                      Quantity
                    </th>
                    <th style={{ padding: "10px", textAlign: "center" }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "10px" }}>
                        <strong>{item.sku}</strong>
                      </td>
                      <td style={{ padding: "10px" }}>{item.name}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            backgroundColor:
                              item.packType === "pack_unit"
                                ? "#dcfce7"
                                : "#fef3c7",
                            color:
                              item.packType === "pack_unit"
                                ? "#166534"
                                : "#92400e",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {item.packType}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {item.quantity} {item.uom}
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          className="copy-button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: "12px", color: "#6b7280", fontSize: "13px" }}>
                Total Items: <strong>{items.length}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="button-group" style={{ marginTop: "20px" }}>
          <button
            className="primary-button"
            onClick={handleStartPacking}
            disabled={!orderId || !clientName || items.length === 0}
          >
            Start Packing →
          </button>
          <button
            className="second-button"
            onClick={() => router.back()}
          >
            Cancel
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
