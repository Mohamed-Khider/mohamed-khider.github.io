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
  validateBarcodeCode,
  buildLocationBarcode,
  type BarcodeItem,
} from "../lib/barcodeGenerator";
import {
  LABEL_SIZES,
  buildLabelSheetZpl,
  calculateLabelLayout,
  dotsToMm,
  getLabelPages,
  type LabelSizeType,
  type PrinterProfile,
  getPrinterProfiles,
  getDefaultPrinterProfile,
  initializePrinterProfiles,
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
  const [labelSize, setLabelSize] = useState<LabelSizeType>("4x6");
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
  
  // Get label dimensions
  const labelDimensions = useMemo(() => {
    return LABEL_SIZES.find(s => s.id === labelSize);
  }, [labelSize]);

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

  const currentLayout = useMemo(() => calculateLabelLayout(labelSize), [labelSize]);

  const getBarcodeModuleWidth = (value: string, widthPx: number) => {
    const totalModules = Math.max(1, value.length * 11 + 35);
    return Math.max(1, Math.min(10, Math.floor(widthPx / totalModules)));
  };

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

      const invalidItem = generated.find((item) => !validateBarcodeCode(item.code).valid);
      if (invalidItem) {
        const validation = validateBarcodeCode(invalidItem.code);
        openNotification(
          "Validation Error",
          `${invalidItem.code}: ${validation.error || "Invalid barcode code"}`,
          "warning"
        );
        setBarcodes([]);
        setZplOutput("");
        return;
      }

      setBarcodes(generated);
      setZplOutput(buildLabelSheetZpl(generated, labelSize));
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

  // Preview pages follow the same Zebra pagination as ZPL, browser print, and PDF.
  const previewPages = useMemo(() => {
    return getLabelPages(barcodes, labelSize);
  }, [barcodes, labelSize]);
  const totalPages = previewPages.length;

  const currentPreviewPage = previewPages[currentPreviewPageIndex] ?? [];

  useEffect(() => {
    setCurrentPreviewPageIndex(0);
  }, [labelSize]);

  // Print handlers
  const handlePrint = async () => {
    if (barcodes.length === 0) {
      openNotification("Nothing to Print", "Generate barcodes first", "warning");
      return;
    }

    setIsPrinting(true);
    try {
      handleOpenBrowserPrintPreview();
      openNotification("Print Preview Ready", "Use the print button in the Zebra preview window.", "success");
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

    const layout = currentLayout;
    const labelWidthMm = dotsToMm(layout.labelWidthDots);
    const labelHeightMm = dotsToMm(layout.labelHeightDots);
    const pageWidthMm = dotsToMm(layout.pageWidthDots);
    const pageHeightMm = dotsToMm(layout.pageHeightDots);
    const pages = getLabelPages(barcodes, labelSize);
    const safePages = JSON.stringify(pages)
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zebra Label Print Preview</title>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background: #f3f4f6;
      color: #111827;
      padding: 20px;
    }

    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: white;
      padding: 12px 20px;
      border-bottom: 2px solid #3b82f6;
      display: flex;
      gap: 12px;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .toolbar button {
      border: 1px solid #d1d5db;
      background: white;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .toolbar button.primary {
      background: #3b82f6;
      color: white;
      border: none;
    }

    .status {
      margin-left: auto;
      color: #6b7280;
      font-size: 13px;
    }

    .preview-container {
      margin-top: 80px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 40px;
    }

    .page {
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      background: white;
      border: 2px solid #3b82f6;
      display: grid;
      grid-template-columns: repeat(${layout.labelsPerRow}, 1fr);
      grid-template-rows: repeat(${layout.rowsPerPage}, 1fr);
      gap: 0;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .label-cell {
      width: 100%;
      height: 100%;
      border: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${layout.sheetMode ? "1.5mm" : "2mm"};
      padding: ${layout.sheetMode ? "2mm 4mm" : "2mm"};
      font-family: Arial, sans-serif;
    }

    .barcode-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }

    .barcode-container svg {
      max-width: 100%;
      max-height: 100%;
      width: 100%;
      height: auto;
    }

    .label-code {
      font-size: ${Math.max(8, Math.min(18, labelHeightMm * 0.16))}px;
      font-weight: 700;
      text-align: center;
      word-break: break-word;
      width: 100%;
    }

    .zpl-section {
      margin-top: 40px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-left: 20px;
      margin-right: 20px;
    }

    .zpl-box {
      background: #1f2937;
      color: #f3f4f6;
      padding: 16px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      max-height: 300px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      .toolbar {
        display: none;
      }
      .preview-container {
        margin-top: 0;
        gap: 0;
      }
      .page {
        margin: 0;
        page-break-after: always;
        box-shadow: none;
        border: none;
      }
      .zpl-section {
        display: none;
      }
    }

    @page {
      margin: 0;
      size: ${pageWidthMm}mm ${pageHeightMm}mm;
    }
  </style>
</head>

<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">🖨️ Print Labels</button>
    <button onclick="copyZpl()">📋 Copy ZPL</button>
    <div class="status" id="status">Ready</div>
  </div>

  <div class="preview-container" id="preview"></div>

  <div class="zpl-section">
    <h3>ZPL Output</h3>
    <div class="zpl-box" id="zpl"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <script>
    const pages = ${safePages};
    const zplText = ${safeZpl};
    const labelsPerRow = ${layout.labelsPerRow};
    const labelsPerPage = ${layout.labelsPerPage};
    const totalCells = ${layout.labelsPerPage};
    const barcodeHeight = ${Math.max(42, Math.min(110, Math.floor(layout.labelHeightDots * 0.48)))};

    const preview = document.getElementById("preview");
    const status = document.getElementById("status");
    const zplBox = document.getElementById("zpl");

    zplBox.textContent = zplText;

    function moduleWidthFor(value, cellWidth) {
      const totalModules = Math.max(1, value.length * 11 + 35);
      return Math.max(1, Math.min(10, Math.floor(cellWidth / totalModules)));
    }

    function render() {
      pages.forEach(pageItems => {
        const pageDiv = document.createElement("div");
        pageDiv.className = "page";

        for (let i = 0; i < totalCells; i++) {
          const item = pageItems[i];
          const cellDiv = document.createElement("div");
          cellDiv.className = "label-cell";

          if (item) {
            // Barcode container
            const barcodeContainer = document.createElement("div");
            barcodeContainer.className = "barcode-container";

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            
            try {
              JsBarcode(svg, item.code, {
                format: "CODE128",
                width: moduleWidthFor(item.code, cellDiv.clientWidth || ${layout.labelWidthDots}),
                height: barcodeHeight,
                displayValue: false,
                margin: 0,
              });
            } catch (e) {
              console.error("Barcode error:", e);
              cellDiv.innerHTML = "Error";
            }

            barcodeContainer.appendChild(svg);
            cellDiv.appendChild(barcodeContainer);

            // Code text
            const codeDiv = document.createElement("div");
            codeDiv.className = "label-code";
            codeDiv.textContent = item.code;
            cellDiv.appendChild(codeDiv);
          }

          pageDiv.appendChild(cellDiv);
        }

        preview.appendChild(pageDiv);
      });
    }

    async function copyZpl() {
      try {
        await navigator.clipboard.writeText(zplText);
        status.textContent = "✓ Copied!";
        setTimeout(() => { status.textContent = "Ready"; }, 2000);
      } catch (e) {
        status.textContent = "Copy failed";
      }
    }

    render();
  <\/script>
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
      if (!labelDimensions) {
        throw new Error("Invalid label size");
      }

      const layout = currentLayout;
      const labelWidthMm = dotsToMm(layout.labelWidthDots);
      const labelHeightMm = dotsToMm(layout.labelHeightDots);
      const pageWidthMm = dotsToMm(layout.pageWidthDots);
      const pageHeightMm = dotsToMm(layout.pageHeightDots);

      // Create PDF with page size matching Zebra printer
      const pdf = new jsPDF({
        orientation: pageHeightMm > pageWidthMm ? "portrait" : "landscape",
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
      });

      // Arrange labels into pages
      const pages = getLabelPages(barcodes, labelSize);

      // Generate each page
      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage([pageWidthMm, pageHeightMm]);
        }

        const pageItems = pages[pageIdx];
        const pageDiv = document.createElement("div");
        pageDiv.style.width = `${pageWidthMm}mm`;
        pageDiv.style.height = `${pageHeightMm}mm`;
        pageDiv.style.background = "white";
        pageDiv.style.display = "grid";
        pageDiv.style.gridTemplateColumns = `repeat(${layout.labelsPerRow}, 1fr)`;
        pageDiv.style.gridTemplateRows = `repeat(${layout.rowsPerPage}, 1fr)`;
        pageDiv.style.gap = "0";
        pageDiv.style.padding = "0";
        pageDiv.style.position = "absolute";
        pageDiv.style.left = "0";
        pageDiv.style.top = "0";
        pageDiv.style.zIndex = "-1";
        pageDiv.style.fontFamily = "Arial, sans-serif";
        pageDiv.style.boxSizing = "border-box";

        // Fill remaining slots with empty cells
        const totalSlots = layout.labelsPerPage;
        
        for (let i = 0; i < totalSlots; i++) {
          const item = pageItems[i];
          const cellDiv = document.createElement("div");
          cellDiv.style.width = `${labelWidthMm}mm`;
          cellDiv.style.height = `${labelHeightMm}mm`;
          cellDiv.style.border = "0";
          cellDiv.style.boxSizing = "border-box";
          cellDiv.style.padding = layout.sheetMode ? "2mm 4mm" : "2mm";
          cellDiv.style.display = "flex";
          cellDiv.style.flexDirection = "column";
          cellDiv.style.alignItems = "center";
          cellDiv.style.justifyContent = "center";
          cellDiv.style.gap = layout.sheetMode ? "1.5mm" : "2mm";
          cellDiv.style.background = "white";

          if (item) {
            // Barcode
            const barcodeDiv = document.createElement("div");
            barcodeDiv.style.flex = "1";
            barcodeDiv.style.display = "flex";
            barcodeDiv.style.alignItems = "center";
            barcodeDiv.style.justifyContent = "center";
            barcodeDiv.style.width = "100%";

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.height = "100%";
            svg.style.maxHeight = `${Math.floor(labelHeightMm * 0.48)}mm`;
            svg.style.width = "100%";

            JsBarcode(svg, item?.code, {
              format: "CODE128",
              width: getBarcodeModuleWidth(item.code, layout.labelWidthDots - 64),
              height: Math.max(42, Math.min(110, Math.floor(layout.labelHeightDots * 0.48))),
              displayValue: false,
              margin: 0,
            });

            barcodeDiv.appendChild(svg);
            cellDiv.appendChild(barcodeDiv);

            // Text
            const textDiv = document.createElement("div");
            textDiv.style.fontSize = `${Math.max(8, Math.min(18, labelHeightMm * 0.16))}px`;
            textDiv.style.fontWeight = "700";
            textDiv.style.textAlign = "center";
            textDiv.style.wordBreak = "break-word";
            textDiv.style.width = "100%";
            textDiv.style.color = "#000";
            textDiv.textContent = item.code;
            cellDiv.appendChild(textDiv);
          }

          pageDiv.appendChild(cellDiv);
        }

        document.body.appendChild(pageDiv);

        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          allowTaint: true,
        });

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm);
        document.body.removeChild(pageDiv);
      }

      pdf.save("labels.pdf");
      openNotification("PDF Downloaded", `${pages.length} page(s) with ${barcodes.length} label(s)`, "success");
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
                onChange={(e) => setLabelSize(e.target.value as LabelSizeType)}
              >
                {LABEL_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
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
                    padding: "10px",
                    width: currentLayout.sheetMode ? "420px" : `${Math.min(520, Math.max(180, currentLayout.pageWidthDots * 0.45))}px`,
                    aspectRatio: `${currentLayout.pageWidthDots} / ${currentLayout.pageHeightDots}`,
                    margin: "0 auto",
                  }}
                >
                  <div style={{ marginBottom: "12px", fontSize: "13px", color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Print Page {currentPreviewPageIndex + 1} of {totalPages}</span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {currentLayout.sheetMode ? "6 labels per 4x6 page" : "1 label per page"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${currentLayout.labelsPerRow}, 1fr)`,
                      gridTemplateRows: `repeat(${currentLayout.rowsPerPage}, 1fr)`,
                      gap: "0",
                      height: "calc(100% - 28px)",
                    }}
                  >
                    {Array.from({ length: currentLayout.labelsPerPage }).map((_, idx) => {
                      const item = currentPreviewPage[idx];
                      return (
                      <div
                        key={item ? `${item.code}-${idx}` : `empty-${idx}`}
                        style={{
                          border: "1px dashed #e5e7eb",
                          padding: currentLayout.sheetMode ? "8px 14px" : "8px",
                          backgroundColor: "white",
                          display: "grid",
                          gridTemplateRows: "auto auto",
                          gap: currentLayout.sheetMode ? "4px" : "6px",
                          alignItems: "center",
                        }}
                      >
                        {item && (
                          <>
                        <svg
                          ref={(element) => {
                            if (element) {
                              const parentWidth = element.parentElement?.clientWidth || element.clientWidth || 300;
                              JsBarcode(element, item.code, {
                                format: "CODE128",
                                width: getBarcodeModuleWidth(item.code, parentWidth - 16),
                                height: currentLayout.sheetMode ? 62 : Math.max(40, Math.min(90, currentLayout.labelHeightDots * 0.32)),
                                displayValue: false,
                                margin: 0,
                              });
                            }
                          }}
                          style={{ width: "100%", height: currentLayout.sheetMode ? "62px" : "48px" }}
                        />
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: currentLayout.sheetMode ? "12px" : "10px",
                            fontWeight: 600,
                            color: "#1f2937",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.code}
                        </div>
                          </>
                        )}
                      </div>
                    );
                    })}
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
                    {labelDimensions?.label || labelSize}
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

