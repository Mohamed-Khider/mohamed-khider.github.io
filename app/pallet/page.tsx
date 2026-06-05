"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import NotificationModal from "../components/NotificationModal";
import PageHeader from "../components/PageHeader";
import { sendZplToPrinter } from "../lib/printService";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { addPrintHistory, getPrintHistoryByType, initializePrintHistory, PrintHistoryEntry } from "../lib/printHistory";

const rangeOne = ["01", "02", "03", "04", "05", "06"];
const rangeTwo = ["07", "08", "09", "10"];

export default function PalletPage() {
  const [cValue, setCValue] = useState("");
  const [range, setRange] = useState("1");
  const [codes, setCodes] = useState<string[]>([]);
  const [printerIp, setPrinterIp] = useState("");
  const [printHistory, setPrintHistory] = useState<PrintHistoryEntry[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const svgRefs = useRef<Array<SVGSVGElement | null>>([]);

  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");
  const base = useMemo(() => `${cValue.trim().toUpperCase()}-PLT`, [cValue]);

  const loadHistory = () => {
    initializePrintHistory();
    setPrintHistory(getPrintHistoryByType("pallet"));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "warning") => {
    setNotification({ title, message, type });
  };

  const handleCopyZpl = async () => {
    if (!zplText) {
      openNotification("No ZPL Output", "Generate labels before copying ZPL.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(zplText);
      openNotification("Copied", "Pallet ZPL copied to clipboard.", "success");
    } catch (error) {
      openNotification("Copy Failed", String(error), "warning");
    }
  };

  const handleGenerate = () => {
    const normalizedC = cValue.trim().toUpperCase();
    if (!normalizedC) {
      openNotification("Missing C Value", "Enter a C value first before generating labels.", "warning");
      return;
    }

    const suffixes = range === "1" ? rangeOne : rangeTwo;
    setCodes(suffixes.map((suffix) => `${base}-${suffix}`));
  };

  const handlePrint = async () => {
    if (!codes.length) {
      openNotification("Nothing to Print", "Generate labels before printing.", "warning");
      return;
    }

    if (!canPrint) {
      openNotification("Permission Required", "Your account does not have permission to print labels. Contact an administrator.", "warning");
      return;
    }

    setIsPrinting(true);

    try {
      await sendZplToPrinter(zplText);
      addPrintHistory({
        type: "pallet",
        title: "Pallet labels printed",
        location: base,
        codes,
        printerIp: printerIp || undefined,
        action: "printed",
        user: currentUser?.username || "anonymous"
      });
      loadHistory();
      openNotification("Printed Successfully", "Pallet labels were sent to your printer.", "success");
    } catch (error) {
      openNotification("Print Failed", String(error), "warning");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendToZebra = async () => {
    if (!zplText) {
      openNotification("No ZPL Output", "Generate labels before sending to the Zebra printer.", "warning");
      return;
    }

    if (!canPrint) {
      openNotification("Permission Required", "Your account does not have permission to send labels to the Zebra printer.", "warning");
      return;
    }

    setIsSending(true);

    try {
      await sendZplToPrinter(zplText, printerIp || undefined);
      addPrintHistory({
        type: "pallet",
        title: "Pallet ZPL sent",
        location: base,
        codes,
        printerIp: printerIp || undefined,
        action: "sent",
        user: currentUser?.username || "anonymous"
      });
      loadHistory();
      openNotification("ZPL Sent", "ZPL was successfully sent to the Zebra printer.", "success");
    } catch (error) {
      openNotification("Printer Error", String(error), "warning");
    } finally {
      setIsSending(false);
    }
  };

  const zplText = useMemo(() => {
    if (!codes.length) {
      return "";
    }

    let y = 60;
    let zpl = `^XA\n^PW812\n^LL1218\n^BY5,2,120\n\n`;

    codes.forEach((code) => {
      zpl += `^FO100,${y}\n^BCN,100,Y,N,N\n^FD${code}^FS\n\n`;
      y += 200;
    });

    zpl += "^XZ";
    return zpl;
  }, [codes]);

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Pallet Label Generator"
          subtitle="Generate pallet barcode labels and preview the ZPL output."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <div className="form-field">
            <label htmlFor="cInput">C value</label>
            <input
              id="cInput"
              type="text"
              value={cValue}
              onChange={(event) => setCValue(event.target.value)}
              placeholder="e.g. 07"
            />
          </div>

          <div className="form-field">
            <label htmlFor="rangeSelect">Range</label>
            <select
              id="rangeSelect"
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="1">01–06</option>
              <option value="2">07–10</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="printerIp">Printer IP</label>
            <input
              id="printerIp"
              type="text"
              value={printerIp}
              onChange={(event) => setPrinterIp(event.target.value)}
              placeholder="Optional if ZEBRA_PRINTER_IP is configured"
            />
          </div>

          <div className="button-group">
            <button className="primary-button" type="button" onClick={handleGenerate}>
              Generate
            </button>
            <button className="second-button" type="button" onClick={handlePrint} disabled={!codes.length || isPrinting}>
              {isPrinting ? "Printing..." : "Print"}
            </button>
            <button className="copy-button" type="button" onClick={handleCopyZpl} disabled={!codes.length}>
              Copy ZPL
            </button>
            <button
              className="second-button"
              type="button"
              onClick={handleSendToZebra}
              disabled={isSending || isPrinting || !codes.length || !canPrint}
            >
              {isSending ? "Sending..." : "Send to Zebra"}
            </button>
          </div>
          {!canPrint && (
            <div className="warning-banner">
              Your account does not have print permission. Contact an administrator to enable printer access.
            </div>
          )}
        </div>

        <div className="card output-section">
          <div className="output-side">
            <h2>Label Preview</h2>
            <div className="preview-grid" id="print-only">
              {codes.map((code, index) => (
                <div className="label-card" key={code}>
                  <svg
                    ref={(element) => {
                      svgRefs.current[index] = element;
                      if (element) {
                        JsBarcode(element, code, {
                          format: "CODE128",
                          width: 1,
                          height: 80,
                          displayValue: false,
                          margin: 0,
                        });
                      }
                    }}
                  />
                  <div className="label-value">{code}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="output-side">
            <h2>ZPL Code</h2>
            <pre className="pre-code">{zplText || "Generate labels to view ZPL output."}</pre>
          </div>
        </div>

        <div className="card" style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Print History</h2>
            <span style={{ fontSize: "14px", color: "#6b7280" }}>{printHistory.length} entries</span>
          </div>
          {printHistory.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>When</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Action</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Location</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Codes</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {printHistory.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px" }}>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "10px" }}>{entry.action}</td>
                      <td style={{ padding: "10px" }}>{entry.location}</td>
                      <td style={{ padding: "10px" }}>{entry.codes.join(", ")}</td>
                      <td style={{ padding: "10px" }}>{entry.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#6b7280", marginTop: "12px" }}>No pallet print history yet. Print or send a label to create the first record.</p>
          )}
        </div>
        <NotificationModal
          open={!!notification}
          title={notification?.title ?? "Notification"}
          message={notification?.message ?? ""}
          type={notification?.type ?? "warning"}
          onClose={() => setNotification(null)}
        />
      </div>
    </ProtectedPage>
  );
}
