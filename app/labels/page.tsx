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
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // UI state
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: "warning" | "success" | "info";
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const previewRef = useRef<HTMLDivElement>(null);
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
      const zpl = generateZpl(generated, { labelSize });
      setZplOutput(zpl);
      setCurrentPageIndex(0);
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

  // Pagination for large label previews
  const itemsPerPage = labelSize === "2.5x1" ? 1 : 4;
  const totalPages = Math.ceil(barcodes.length / itemsPerPage);
  const currentPageBarcodes = useMemo(() => {
    const start = currentPageIndex * itemsPerPage;
    return barcodes.slice(start, start + itemsPerPage);
  }, [currentPageIndex, barcodes, itemsPerPage]);

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
      openNotification("Sent to Printer", "Check your printer", "success");
    } catch (err) {
      openNotification("Print Failed", String(err), "warning");
    } finally {
      setIsPrinting(false);
    }
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
      // Label dimensions in millimeters
      const isSmallLabel = labelSize === "2.5x1";
      const labelWidthMm = isSmallLabel ? 63.5 : 101.6;   // 2.5" or 4" in mm
      const labelHeightMm = isSmallLabel ? 25.4 : 152.4;  // 1" or 6" in mm
      const labelsPerPage = isSmallLabel ? 1 : 4;
      const totalPages = Math.ceil(barcodes.length / labelsPerPage);

      // Create PDF with label-sized pages
      const pdf = new jsPDF({
        orientation: isSmallLabel ? "landscape" : "portrait",
        unit: "mm",
        format: [labelWidthMm, labelHeightMm],
      });

      // Render each label page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage([labelWidthMm, labelHeightMm]);
        }

        // Get barcodes for this page
        const startIdx = pageIndex * labelsPerPage;
        const endIdx = Math.min(startIdx + labelsPerPage, barcodes.length);
        const pageItems = barcodes.slice(startIdx, endIdx);

        // Create temporary div for this page
        const pageDiv = document.createElement("div");
        pageDiv.style.width = `${labelWidthMm}mm`;
        pageDiv.style.height = `${labelHeightMm}mm`;
        pageDiv.style.display = "grid";
        pageDiv.style.gridTemplateColumns = isSmallLabel ? "1fr" : "repeat(2, 1fr)";
        pageDiv.style.gridAutoRows = isSmallLabel ? "1fr" : "repeat(2, 1fr)";
        pageDiv.style.gap = "0";
        pageDiv.style.padding = "0";
        pageDiv.style.margin = "0";
        pageDiv.style.background = "white";
        pageDiv.style.position = "absolute";
        pageDiv.style.left = "-9999px";
        pageDiv.style.top = "-9999px";

        // Add each barcode to the page grid
        pageItems.forEach((item) => {
          const cellDiv = document.createElement("div");
          cellDiv.style.display = "flex";
          cellDiv.style.flexDirection = "column";
          cellDiv.style.alignItems = "center";
          cellDiv.style.justifyContent = "center";
          cellDiv.style.padding = isSmallLabel ? "4px" : "8px";
          cellDiv.style.gap = "4px";
          cellDiv.style.background = "white";
          cellDiv.style.border = "0.5px solid #f0f0f0";

          // Create SVG for barcode
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.style.maxWidth = "90%";
          svg.style.height = isSmallLabel ? "35px" : "60px";

          JsBarcode(svg, item.code, {
            format: "CODE128",
            width: isSmallLabel ? 1.5 : 2,
            height: isSmallLabel ? 40 : 70,
            displayValue: false,
            margin: 2,
          });

          cellDiv.appendChild(svg);

          // Add label text
          const textDiv = document.createElement("div");
          textDiv.style.fontSize = isSmallLabel ? "9px" : "11px";
          textDiv.style.fontWeight = "600";
          textDiv.style.textAlign = "center";
          textDiv.style.color = "#1f2937";
          textDiv.style.wordBreak = "break-all";
          textDiv.style.maxWidth = "100%";
          textDiv.style.lineHeight = "1.2";
          textDiv.textContent = item.code;
          cellDiv.appendChild(textDiv);

          pageDiv.appendChild(cellDiv);
        });

        // Add empty cells for incomplete grid rows (for 4x6 labels)
        if (!isSmallLabel && pageItems.length % 2 === 1) {
          const emptyCell = document.createElement("div");
          emptyCell.style.background = "white";
          emptyCell.style.border = "0.5px solid #f0f0f0";
          pageDiv.appendChild(emptyCell);
        }

        // Append to body temporarily
        document.body.appendChild(pageDiv);

        // Convert to canvas and add to PDF
        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, labelWidthMm, labelHeightMm);

        // Remove temporary element
        document.body.removeChild(pageDiv);
      }

      // Save PDF
      pdf.save("labels.pdf");

      // Open print dialog after saving
      setTimeout(() => {
        window.print();
      }, 500);

      openNotification(
        "Downloaded & Printing",
        "PDF saved and print dialog opened",
        "success"
      );
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
                <option value="2.5x1">2.5" x 1" (Small)</option>
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
                Generated {barcodes.length} barcode(s) - Showing page{" "}
                {currentPageIndex + 1} of {totalPages}
              </p>

              <div
                ref={containerRef}
                id="print-only"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    labelSize === "2.5x1" ? "1fr" : "repeat(2, 1fr)",
                  gap: "20px",
                  marginBottom: "20px",
                  padding: "20px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                }}
              >
                {currentPageBarcodes.map((item, idx) => (
                  <div
                    key={`${item.code}-${idx}`}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      padding: "12px",
                      backgroundColor: "white",
                    }}
                  >
                    <svg
                      ref={(element) => {
                        if (element) {
                          JsBarcode(element, item.code, {
                            format: "CODE128",
                            width: 2,
                            height: labelSize === "2.5x1" ? 60 : 100,
                            displayValue: false,
                            margin: 0,
                          });
                        }
                      }}
                      style={{ width: "100%", marginBottom: "8px" }}
                    />
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "#374151",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.code}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  <button
                    className="second-button"
                    onClick={() =>
                      setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
                    }
                    disabled={currentPageIndex === 0}
                  >
                    ← Previous
                  </button>
                  <span style={{ alignSelf: "center", minWidth: "100px", textAlign: "center" }}>
                    Page {currentPageIndex + 1} of {totalPages}
                  </span>
                  <button
                    className="second-button"
                    onClick={() =>
                      setCurrentPageIndex(
                        Math.min(totalPages - 1, currentPageIndex + 1)
                      )
                    }
                    disabled={currentPageIndex === totalPages - 1}
                  >
                    Next →
                  </button>
                </div>
              )}

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
                  onClick={handleSendToZebra}
                  disabled={!canPrint || isSending}
                >
                  {isSending ? "Sending..." : "Send to Zebra"}
                </button>
                <button className="copy-button" onClick={handleCopyZpl}>
                  Copy ZPL
                </button>
                <button className="second-button" onClick={handleDownloadPdf}>
                  📥 PDF & Print
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

