"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ProtectedPage from "../components/ProtectedPage";
import NotificationModal from "../components/NotificationModal";
import PageHeader from "../components/PageHeader";
import {
  generateBarcodeRange,
  generateZpl,
  getLabelDimensions,
  validateBarcodeCode,
  buildLocationBarcode,
  type LabelSize,
  type BarcodeItem,
} from "../lib/barcodeGenerator";
import {
  getPrinterProfiles,
  getDefaultPrinterProfile,
  initializePrinterProfiles,
  type PrinterProfile,
} from "../lib/labelManagement";
import { sendZplToPrinter } from "../lib/printService";
import { getCurrentUser, hasPermission } from "../lib/userManagement";

type GenerationMode = "single" | "range" | "list" | "location";

interface LocationFormData {
  warehouse: string;
  zone: string;
  section: string;
  level: string;
  startNum: string;
  endNum: string;
}

export default function UnifiedLabelGeneratorPage() {
  // State management
  const [generationMode, setGenerationMode] = useState<GenerationMode>("single");
  const [labelSize, setLabelSize] = useState<LabelSize>("4x6");
  const [printerIp, setPrinterIp] = useState("");
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // Single mode
  const [singleCode, setSingleCode] = useState("");

  // Range mode
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangePrefix, setRangePrefix] = useState("");

  // List mode
  const [listInput, setListInput] = useState("");

  // Location mode
  const [locationForm, setLocationForm] = useState<LocationFormData>({
    warehouse: "",
    zone: "",
    section: "",
    level: "",
    startNum: "1",
    endNum: "1",
  });

  // Generated codes
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([]);
  const [zplOutput, setZplOutput] = useState("");
  const [currentPreviewPageIndex, setCurrentPreviewPageIndex] = useState(0);

  // UI state
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: "warning" | "success" | "info";
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");
  const dimensions = getLabelDimensions(labelSize);

  useEffect(() => {
    initializePrinterProfiles();
    const savedProfiles = getPrinterProfiles();
    setPrinterProfiles(savedProfiles);
    const defaultProfile = getDefaultPrinterProfile();
    setSelectedProfileId(defaultProfile?.id ?? savedProfiles[0]?.id ?? "");
  }, []);

  const selectedProfile = useMemo(
    () => printerProfiles.find((profile) => profile.id === selectedProfileId),
    [printerProfiles, selectedProfileId]
  );

  // Generate barcodes based on mode
  const handleGenerate = () => {
    let generated: BarcodeItem[] = [];
    let error: string | null = null;

    try {
      switch (generationMode) {
        case "single": {
          if (!singleCode.trim()) {
            error = "Please enter a barcode code";
            break;
          }
          const validation = validateBarcodeCode(singleCode);
          if (!validation.valid) {
            error = validation.error || "Invalid barcode code";
            break;
          }
          generated = [{ code: singleCode.trim(), label: singleCode.trim() }];
          break;
        }

        case "range": {
          if (!rangeStart || !rangeEnd) {
            error = "Please enter start and end numbers";
            break;
          }
          const start = parseInt(rangeStart, 10);
          const end = parseInt(rangeEnd, 10);
          if (isNaN(start) || isNaN(end) || start > end) {
            error = "Invalid range";
            break;
          }
          generated = generateBarcodeRange(`${start}-${end}`, rangePrefix);
          break;
        }

        case "list": {
          if (!listInput.trim()) {
            error = "Please enter barcode codes";
            break;
          }
          const codes = listInput
            .split(/[\n,]/)
            .map((c) => c.trim())
            .filter(Boolean);
          generated = codes.map((code) => ({
            code,
            label: code,
          }));
          break;
        }

        case "location": {
          if (
            !locationForm.warehouse ||
            !locationForm.zone ||
            !locationForm.section
          ) {
            error = "Please fill in warehouse, zone, and section";
            break;
          }
          const start = parseInt(locationForm.startNum, 10) || 1;
          const end = parseInt(locationForm.endNum, 10) || 1;
          if (isNaN(start) || isNaN(end) || start > end) {
            error = "Invalid range";
            break;
          }

          for (let i = start; i <= end; i++) {
            const code = buildLocationBarcode(
              locationForm.warehouse,
              locationForm.zone,
              locationForm.section,
              `L${i}${locationForm.level || "A"}`
            );
            generated.push({ code, label: code });
          }
          break;
        }
      }

      if (error) {
        openNotification("Validation Error", error, "warning");
        setBarcodes([]);
        setZplOutput("");
        return;
      }

      if (generated.length === 0) {
        openNotification("No Barcodes", "Please check your input", "warning");
        return;
      }

      setBarcodes(generated);
      const zpl = generateZpl(generated, {
  labelSize,
  labelTemplate: "standard",
});
      setZplOutput(zpl);
      setCurrentPreviewPageIndex(0);
      openNotification(
        "Success",
        `Generated ${generated.length} barcode(s)`,
        "success"
      );
    } catch (err) {
      openNotification(
        "Error",
        err instanceof Error ? err.message : "Generation failed",
        "warning"
      );
    }
  };

  // Preview pages of labels for printing — always show one label per preview page
  const itemsPerPage = 1;
  const totalPages = Math.ceil(barcodes.length / itemsPerPage);
  const previewPages = useMemo(() => {
    const pages: BarcodeItem[][] = [];
    for (let i = 0; i < barcodes.length; i += itemsPerPage) {
      pages.push(barcodes.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [barcodes, itemsPerPage]);

  const currentPreviewPage = previewPages[currentPreviewPageIndex] ?? [];

  // Print handlers
  const handlePrint = async () => {
    if (barcodes.length === 0) {
      openNotification("Nothing to Print", "Generate barcodes first", "warning");
      return;
    }

    setIsPrinting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.print();
      openNotification("Sent to Printer", "Print dialog opened", "success");
    } catch (err) {
      openNotification("Print Failed", String(err), "warning");
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintZpl = async () => {
    if (!zplOutput) {
      openNotification("No ZPL", "Generate barcodes first", "warning");
      return;
    }

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Unable to open ZPL print window.");
      }

      const escapeHtml = (text: string) =>
        text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");

      printWindow.document.write(`<!DOCTYPE html><html><head><title>Print ZPL</title><style>
        body { margin: 20px; font-family: monospace; white-space: pre-wrap; font-size: 12px; }
        pre { word-break: break-word; }
      </style></head><body><pre>${escapeHtml(zplOutput)}</pre></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      openNotification("ZPL Print Failed", String(err), "warning");
    }
  };

 const handleOpenBrowserPrintPreview = () => {
  if (barcodes.length === 0) {
    openNotification("Nothing to Preview", "Generate barcodes first", "warning");
    return;
  }

  // Safe serialization
  const safePages = JSON.stringify(previewPages)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  const safeZpl = JSON.stringify(zplOutput)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Zebra Browser Print Preview</title>

  <style>
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      background: #f3f4f6;
      color: #111827;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: white;
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .toolbar button {
      border: 1px solid #9ca3af;
      background: white;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
    }

    .toolbar button.primary {
      background: #2563eb;
      color: white;
      border: none;
    }

    .status {
      margin-left: auto;
      color: #6b7280;
    }

    .page {
      width: 760px;
      margin: 24px auto;
      padding: 16px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }

    .label-card {
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-bottom: 10px;
    }

    .code-text {
      text-align: center;
      font-weight: bold;
      font-size: 12px;
    }

    .zpl-box {
      background: #111827;
      color: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      margin-top: 16px;
      font-family: monospace;
      font-size: 12px;
      max-height: 260px;
      overflow: auto;
      white-space: pre-wrap;
    }
  </style>
</head>

<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">Print</button>
    <button onclick="copyZpl()">Copy ZPL</button>
    <button class="primary" onclick="sendUsb()">Send USB</button>
    <div class="status" id="status">Ready</div>
  </div>

  <div id="preview"></div>

  <div class="page">
    <h3>ZPL Output</h3>
    <div class="zpl-box" id="zpl"></div>
  </div>

  <script>
    const pages = ${safePages};
    const zplText = ${safeZpl};

    const preview = document.getElementById("preview");
    const status = document.getElementById("status");
    const zplBox = document.getElementById("zpl");

    zplBox.textContent = zplText;

    function render() {
      pages.forEach((pageItems, index) => {
        const page = document.createElement("div");
        page.className = "page";

        pageItems.forEach(item => {
          const card = document.createElement("div");
          card.className = "label-card";

          const text = document.createElement("div");
          text.className = "code-text";
          text.textContent = item.code;

          card.appendChild(text);
          page.appendChild(card);
        });

        preview.appendChild(page);
      });
    }

    async function copyZpl() {
      try {
        await navigator.clipboard.writeText(zplText);
        status.textContent = "Copied!";
      } catch (e) {
        status.textContent = "Copy failed";
      }
    }

    async function sendUsb() {
      if (!navigator.usb) {
        status.textContent = "WebUSB not supported";
        return;
      }

      try {
        const device = await navigator.usb.requestDevice({
          filters: [{ vendorId: 0x0a5f }]
        });

        await device.open();
        if (!device.configuration) await device.selectConfiguration(1);

        const iface = device.configuration.interfaces[0];
        await device.claimInterface(iface.interfaceNumber);

        const endpoint = iface.alternates[0].endpoints.find(e => e.direction === "out");

        const data = new TextEncoder().encode(zplText);
        await device.transferOut(endpoint.endpointNumber, data);

        await device.close();

        status.textContent = "Sent to printer";
      } catch (e) {
        status.textContent = "USB failed";
      }
    }

    render();
  </script>
</body>

</html>
`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
};

  const handleSendToZebra = async () => {
    if (!zplOutput) {
      openNotification("No ZPL", "Generate barcodes first", "warning");
      return;
    }

    if (!canPrint) {
      openNotification(
        "Permission Denied",
        "You don't have printer access",
        "warning"
      );
      return;
    }

    setIsSending(true);
    try {
      if (selectedProfile) {
        await sendZplToPrinter(zplOutput, {
          method: selectedProfile.connectionMethod,
          address: selectedProfile.address,
        });
      } else {
        await sendZplToPrinter(zplOutput, printerIp || undefined);
      }
      openNotification("Sent to Zebra", "Labels printing", "success");
    } catch (err) {
      openNotification("Send Failed", String(err), "warning");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyZpl = async () => {
    if (!zplOutput) {
      openNotification("No ZPL", "Generate barcodes first", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(zplOutput);
      openNotification("Copied", "ZPL code in clipboard", "success");
    } catch (err) {
      openNotification("Copy Failed", String(err), "warning");
    }
  };

  const handleDownloadPdf = async () => {
    if (barcodes.length === 0) {
      openNotification("Nothing to Export", "Generate barcodes first", "warning");
      return;
    }

    try {
      const isSmallLabel = labelSize === "2x1";
      const labelWidthMm = isSmallLabel ? 50.8 : 101.6; // 2" or 4" in mm
      const labelHeightMm = isSmallLabel ? 25.4 : 152.4; // 1" or 6" in mm
      const labelsPerPage = 1;
      const pageHeightMm = labelHeightMm;
      const totalPages = Math.ceil(barcodes.length / labelsPerPage);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [labelWidthMm, pageHeightMm],
      });

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage([labelWidthMm, pageHeightMm]);
        }

        const startIdx = pageIndex * labelsPerPage;
        const endIdx = Math.min(startIdx + labelsPerPage, barcodes.length);
        const pageItems = barcodes.slice(startIdx, endIdx);

        const pageDiv = document.createElement("div");
        pageDiv.style.width = `${labelWidthMm}mm`;
        pageDiv.style.height = `${pageHeightMm}mm`;
        pageDiv.style.padding = "2px";
        pageDiv.style.background = "white";
        pageDiv.style.display = "flex";
        pageDiv.style.flexDirection = "column";
        pageDiv.style.gap = "4px";
        pageDiv.style.position = "absolute";
        pageDiv.style.left = "-9999px";
        pageDiv.style.top = "-9999px";

        pageItems.forEach((item) => {
          const cellDiv = document.createElement("div");
          cellDiv.style.display = "flex";
          cellDiv.style.flexDirection = "column";
          cellDiv.style.alignItems = "center";
          cellDiv.style.justifyContent = "center";
          cellDiv.style.width = "100%";
          cellDiv.style.flex = "1 0 auto";
          cellDiv.style.border = "1px solid #d1d5db";
          cellDiv.style.padding = "2px";
          cellDiv.style.background = "white";
          cellDiv.style.boxSizing = "border-box";

          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.style.width = "100%";
          svg.style.height = isSmallLabel ? "25mm" : "35mm";

          JsBarcode(svg, item.code, {
            format: "CODE128",
            width: isSmallLabel ? 1.2 : 2,
            height: isSmallLabel ? 100 : 220,
            displayValue: false,
            margin: 2,
          });

          cellDiv.appendChild(svg);

          const textDiv = document.createElement("div");
          textDiv.style.fontSize = isSmallLabel ? "14px" : "16px";
          textDiv.style.fontWeight = "700";
          textDiv.style.textAlign = "center";
          textDiv.style.wordBreak = "break-word";
          textDiv.style.width = "100%";
          textDiv.textContent = item.code;
          cellDiv.appendChild(textDiv);

          pageDiv.appendChild(cellDiv);
        });

        document.body.appendChild(pageDiv);
        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, labelWidthMm, pageHeightMm);
        document.body.removeChild(pageDiv);
      }

      pdf.save("labels.pdf");
      openNotification("PDF Downloaded", "Your PDF file is ready", "success");
    } catch (err) {
      console.error("PDF error:", err);
      openNotification("Download Failed", String(err), "warning");
    }
  };

  const openNotification = (
    title: string,
    message: string,
    type: "warning" | "success" | "info" = "info"
  ) => {
    setNotification({ title, message, type });
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Unified Label & Barcode Generator"
          subtitle="Generate, customize, and print labels with proper sizing for Zebra printers • Download all labels in one PDF"
          showBack={true}
          showLogout={true}
        />

        {/* Configuration Section */}
        <div className="card">
          <h3>Configuration</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "20px",
            }}
          >
            <div className="form-field">
              <label>Generation Mode</label>
              <select
                value={generationMode}
                onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
              >
                <option value="single">Single Barcode</option>
                <option value="range">Number Range</option>
                <option value="list">Barcode List</option>
                <option value="location">Location Builder</option>
              </select>
            </div>

            <div className="form-field">
              <label>Label Size</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSize)}
              >
                <option value="2x1">2" x 1" (Small)</option>
                <option value="4x6">4" x 6" (Standard)</option>
              </select>
            </div>

            <div className="form-field">
              <label>Printer IP (Optional)</label>
              <input
                type="text"
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>

            <div className="form-field">
              <label>Default Zebra Printer</label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
              >
                <option value="">Manual / No profile</option>
                {printerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.connectionMethod})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedProfile ? (
            <div
              style={{
                backgroundColor: "#f3f4f6",
                color: "#111827",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                marginBottom: "16px",
              }}
            >
              Selected printer: <strong>{selectedProfile.name}</strong>
              <br />
              Connection method: <strong>{selectedProfile.connectionMethod}</strong>
              <br />
              Address: <strong>{selectedProfile.address || "Not set"}</strong>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#eef2ff",
                color: "#1d4ed8",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                marginBottom: "16px",
              }}
            >
              No printer profile selected. You can send ZPL manually by entering a printer IP or use a saved profile.
            </div>
          )}

          {!canPrint && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                marginBottom: "16px",
              }}
            >
              You don't have printer permissions. Contact admin to enable.
            </div>
          )}
        </div>

        {/* Input Section - Dynamic based on mode */}
        <div className="card">
          <h3>Barcode Input</h3>

          {generationMode === "single" && (
            <div className="form-field">
              <label htmlFor="single-code">Barcode Code</label>
              <input
                id="single-code"
                type="text"
                value={singleCode}
                onChange={(e) => setSingleCode(e.target.value)}
                placeholder="e.g., RML-C01-S01-L1A"
              />
            </div>
          )}

          {generationMode === "range" && (
            <>
              <div className="form-field">
                <label htmlFor="prefix">Prefix (Optional)</label>
                <input
                  id="prefix"
                  type="text"
                  value={rangePrefix}
                  onChange={(e) => setRangePrefix(e.target.value)}
                  placeholder="e.g., BIN-S-"
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div className="form-field">
                  <label htmlFor="range-start">Start Number</label>
                  <input
                    id="range-start"
                    type="number"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="range-end">End Number</label>
                  <input
                    id="range-end"
                    type="number"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
            </>
          )}

          {generationMode === "list" && (
            <div className="form-field">
              <label htmlFor="list-input">Barcode List</label>
              <textarea
                id="list-input"
                value={listInput}
                onChange={(e) => setListInput(e.target.value)}
                placeholder="Enter one barcode per line or comma-separated"
                style={{ minHeight: "150px" }}
              />
            </div>
          )}

          {generationMode === "location" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div className="form-field">
                <label htmlFor="warehouse">Warehouse</label>
                <input
                  id="warehouse"
                  type="text"
                  value={locationForm.warehouse}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, warehouse: e.target.value })
                  }
                  placeholder="e.g., RML"
                />
              </div>
              <div className="form-field">
                <label htmlFor="zone">Zone</label>
                <input
                  id="zone"
                  type="text"
                  value={locationForm.zone}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, zone: e.target.value })
                  }
                  placeholder="e.g., C01"
                />
              </div>
              <div className="form-field">
                <label htmlFor="section">Section</label>
                <input
                  id="section"
                  type="text"
                  value={locationForm.section}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, section: e.target.value })
                  }
                  placeholder="e.g., S01"
                />
              </div>
              <div className="form-field">
                <label htmlFor="level">Level Suffix</label>
                <input
                  id="level"
                  type="text"
                  value={locationForm.level}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, level: e.target.value })
                  }
                  placeholder="e.g., A"
                  maxLength={1}
                />
              </div>
              <div className="form-field">
                <label htmlFor="start-num">Start Number</label>
                <input
                  id="start-num"
                  type="number"
                  value={locationForm.startNum}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, startNum: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor="end-num">End Number</label>
                <input
                  id="end-num"
                  type="number"
                  value={locationForm.endNum}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, endNum: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <div className="button-group" style={{ marginTop: "20px" }}>
            <button className="primary-button" onClick={handleGenerate}>
              Generate Barcodes
            </button>
          </div>
        </div>

        {/* Preview Section */}
        {barcodes.length > 0 && (
          <>
            <div className="card">
              <h3>Barcode Preview</h3>
              <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
                Generated {barcodes.length} barcode(s) across {totalPages} print page(s).
              </p>

              <div
                ref={containerRef}
                id="print-only"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  className={`print-page ${labelSize === "2x1" ? "small-label" : "standard-label"}`}
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "12px",
                    width: labelSize === "2x1" ? "180px" : "520px",
                    minHeight: labelSize === "2x1" ? "160px" : "920px",
                    margin: "0 auto",
                  }}
                >
                  <div style={{ marginBottom: "12px", fontSize: "13px", color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Print Page {currentPreviewPageIndex + 1} of {totalPages}</span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {labelSize === "2x1" ? "1 label per preview page" : "6 labels per preview page"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: "10px",
                    }}
                  >
                    {currentPreviewPage.map((item, idx) => (
                      <div
                        key={`${item.code}-${idx}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "8px",
                          backgroundColor: "#f8fafc",
                          minHeight: labelSize === "2x1" ? "40px" : "110px",
                          display: "grid",
                          gridTemplateRows: "auto auto",
                          gap: "6px",
                        }}
                      >
                        <svg
                          ref={(element) => {
                            if (element) {
                              const parentWidth = element.parentElement?.clientWidth || element.clientWidth || 300;
                              const charCount = item.code?.length || 0;
                              const estimatedModules = Math.max(50, charCount * 11 + 35);
                              const modulePx = Math.max(1, Math.floor((parentWidth - 16) / estimatedModules));
                              JsBarcode(element, item.code, {
                                format: "CODE128",
                                width: modulePx,
                                height: labelSize === "2x1" ? 40 : 90,
                                displayValue: false,
                                margin: 0,
                              });
                            }
                          }}
                          style={{ width: "100%", height: labelSize === "2x1" ? "40px" : "90px" }}
                        />
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: labelSize === "2x1" ? "10px" : "12px",
                            fontWeight: 600,
                            color: "#1f2937",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.code}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="second-button"
                    onClick={() =>
                      setCurrentPreviewPageIndex(Math.max(0, currentPreviewPageIndex - 1))
                    }
                    disabled={currentPreviewPageIndex === 0}
                  >
                    ← Previous Page
                  </button>
                  <span style={{ color: "#4b5563", fontSize: "13px" }}>
                    Page {currentPreviewPageIndex + 1} of {totalPages}
                  </span>
                  <button
                    className="second-button"
                    onClick={() =>
                      setCurrentPreviewPageIndex(
                        Math.min(totalPages - 1, currentPreviewPageIndex + 1)
                      )
                    }
                    disabled={currentPreviewPageIndex === totalPages - 1}
                  >
                    Next Page →
                  </button>
                </div>
              </div>

              <div className="button-group">
                <button
                  className="primary-button"
                  onClick={handlePrint}
                  disabled={isPrinting}
                >
                  {isPrinting ? "Printing..." : "Print Labels"}
                </button>
                <button
                  className="second-button"
                  onClick={handleOpenBrowserPrintPreview}
                >
                  Zebra Browser Print Preview
                </button>
                <button
                  className="second-button"
                  onClick={handleSendToZebra}
                  disabled={!canPrint || isSending}
                >
                  {isSending ? "Sending..." : "Send to Zebra"}
                </button>
                <button className="copy-button" onClick={handleCopyZpl}>
                  Copy ZPL
                </button>
                <button className="second-button" onClick={handlePrintZpl}>
                  Print ZPL
                </button>
                <button className="second-button" onClick={handleDownloadPdf}>
                  📥 Download PDF
                </button>
              </div>
            </div>

            {/* Zebra Printer Review */}
            <div className="card">
              <h3>Zebra Printer Review</h3>
              <p style={{ color: "#4b5563", fontSize: "14px", marginBottom: "16px" }}>
                Review your selected Zebra printer settings and label layout before sending.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "18px",
                }}
              >
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <strong>Printer Type</strong>
                  <div style={{ marginTop: "6px", color: "#374151" }}>
                    {selectedProfile ? selectedProfile.connectionMethod.toUpperCase() : "Manual / WiFi"}
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <strong>Printer Address</strong>
                  <div style={{ marginTop: "6px", color: "#374151" }}>
                    {selectedProfile?.address || printerIp || "Not configured"}
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <strong>Label Size</strong>
                  <div style={{ marginTop: "6px", color: "#374151" }}>
                    {labelSize === "2x1" ? "2\" x 1\"" : "4\" x 6\""}
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <strong>Preview Pages</strong>
                  <div style={{ marginTop: "6px", color: "#374151" }}>
                    {totalPages}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  className="second-button"
                  onClick={handleOpenBrowserPrintPreview}
                >
                  Open Zebra Browser Print Preview
                </button>
                <button
                  className="second-button"
                  onClick={handleSendToZebra}
                  disabled={!canPrint || isSending}
                >
                  {isSending ? "Sending..." : "Send to Zebra"}
                </button>
                <button className="copy-button" onClick={handlePrintZpl}>
                  Print ZPL
                </button>
              </div>
            </div>

            {/* ZPL Output */}
            <div className="card">
              <h3>ZPL Output</h3>
              <div
                style={{
                  backgroundColor: "#1f2937",
                  color: "#f3f4f6",
                  padding: "16px",
                  borderRadius: "8px",
                  overflowX: "auto",
                  maxHeight: "300px",
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: "1.5",
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {zplOutput}
                </pre>
              </div>
            </div>
          </>
        )}

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

