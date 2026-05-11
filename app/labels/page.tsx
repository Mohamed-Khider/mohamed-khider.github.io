"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import {
  getPrinterProfiles,
  initializePrinterProfiles,
  getDefaultPrinterProfile,
  buildZpl,
  LABEL_SIZES,
  LabelSizeType,
  PrinterProfile,
} from "../lib/labelManagement";
import { sendZplToPrinter } from "../lib/printService";

const defaultSize = "1x3" as LabelSizeType;

export default function LabelsPage() {
  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");

  const [labelValue, setLabelValue] = useState("");
  const [selectedSize, setSelectedSize] = useState<LabelSizeType>(defaultSize);
  const [printerProfileId, setPrinterProfileId] = useState("");
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    initializePrinterProfiles();
    const saved = getPrinterProfiles();
    setProfiles(saved);
    const defaultProfile = getDefaultPrinterProfile();
    setPrinterProfileId(defaultProfile?.id ?? "");
  }, []);



  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === printerProfileId) || getDefaultPrinterProfile(),
    [printerProfileId, profiles]
  );

  const sizeOptions = LABEL_SIZES;
  const selectedSizeData = useMemo(
    () => LABEL_SIZES.find((size) => size.id === selectedSize) ?? LABEL_SIZES[0],
    [selectedSize]
  );


  const previewHeight = Math.max(180, Math.round((selectedSizeData.height / selectedSizeData.width) * 320));
  const zplText = useMemo(
    () =>
      buildZpl("single", {
        value: labelValue.trim() || "ITEM-000",
        size: selectedSize,
      }),
    [labelValue, selectedSize]
  );

  useEffect(() => {
    const generatePreview = async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          body: JSON.stringify({
            zpl: zplText,
            width: selectedSizeData.width,
            height: selectedSizeData.height,
          }),
        });

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        setPreviewUrl(url);
      } catch (err) {
        console.error("Preview error:", err);
      }
    };

    generatePreview();
  }, [zplText, selectedSizeData]);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handlePrint = async () => {
    if (!labelValue.trim()) {
      openNotification("Missing Label Text", "Enter a barcode value before printing.", "warning");
      return;
    }

    setIsSending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.print();
      openNotification("Printed Successfully", "Label preview was sent to your printer.", "success");
    } catch (err) {
      openNotification("Print Failed", String(err), "warning");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyZpl = async () => {
    if (!zplText) {
      openNotification("No ZPL Output", "Generate a label to copy ZPL.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(zplText);
      openNotification("Copied", "ZPL code copied to clipboard.", "success");
    } catch (err) {
      openNotification("Copy Failed", String(err), "warning");
    }
  };

  const handleSendToPrinter = async () => {
    if (!canPrint) {
      openNotification("Permission Denied", "Your account does not have permission to print labels.", "warning");
      return;
    }

    if (!activeProfile?.printerIp) {
      openNotification("Printer Missing", "Select a printer profile with an IP address.", "warning");
      return;
    }

    setIsSending(true);

    try {
      await sendZplToPrinter(zplText, activeProfile?.printerIp);
      openNotification("Label Sent", "The label was sent to the selected printer.", "success");
    } catch (err) {
      openNotification("Printer Error", err instanceof Error ? err.message : "Failed to send label.", "warning");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Label Management"
          subtitle="Create one barcode label for standard label sizes with live preview and ZPL output."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <div style={{ display: "grid", gap: 20 }}>
            <div className="form-field">
              <label htmlFor="label-value">Label Text</label>
              <input
                id="label-value"
                type="text"
                value={labelValue}
                onChange={(event) => setLabelValue(event.target.value)}
                placeholder="Enter barcode text or SKU"
              />
            </div>


  <div className="form-field">
              <label>Label Size</label>
              <select
                value={selectedSize}
                onChange={(e) =>
                  setSelectedSize(e.target.value as LabelSizeType)
                }
              >
                {LABEL_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {/* <div className="form-field">
              <label>Label Size</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {sizeOptions.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSelectedSize(size.id)}
                    className={selectedSize === size.id ? "active-size-button" : "size-button"}
                    style={{
                      border: selectedSize === size.id ? "1px solid #2563eb" : "1px solid #d1d5db",
                      background: selectedSize === size.id ? "#eff6ff" : "#ffffff",
                      borderRadius: 8,
                      padding: "10px 12px",
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{size.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Standard</div>
                  </button>
                ))}
              </div>
            </div> */}

            <div className="form-field">
              <label htmlFor="printer-profile">Printer Profile</label>
              <select
                id="printer-profile"
                value={printerProfileId}
                onChange={(event) => setPrinterProfileId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} — {profile.printerIp}
                  </option>
                ))}
              </select>
            </div>

            <div className="button-group">
              <button className="primary-button" type="button" onClick={handlePrint} disabled={!labelValue.trim() || isSending}>
                {isSending ? "Printing..." : "Print Preview"}
              </button>
              <button className="second-button" type="button" onClick={handleSendToPrinter} disabled={!canPrint || isSending}>
                {isSending ? "Sending..." : "Send to Zebra"}
              </button>
              <button className="copy-button" type="button" onClick={handleCopyZpl}>
                Copy ZPL
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div>
              <h2>Live Label Preview</h2>
              <p className="subtle-text">Preview the barcode and label text for the selected paper size.</p>
            </div>
          </div>
         
         
         <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>   
            <div className="preview-card" style={{ flex: 1, minWidth: 320}}>
              <div
                style={{
   
                display: "flex",
                height: "100%",
                width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
               
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="ZPL Preview"
                      style={{
                        flex:1,
                        width: "100%",
                        height: "auto",
                        padding: 12,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 24, color: "#999" }}>
                      Generating preview...
                    </span>
                  )}
                </div>
            </div>

            <div  style={{ flex: 1, minWidth: 320}}>
              <pre className="pre-code" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: previewHeight }}>
                {zplText}
              </pre>
            </div>
          </div>
        </div>

        <NotificationModal
          open={!!notification}
          title={notification?.title ?? "Notification"}
          message={notification?.message ?? ""}
          type={notification?.type ?? "info"}
          onClose={() => setNotification(null)}
        />
      </div>
    </ProtectedPage>
  );
}
