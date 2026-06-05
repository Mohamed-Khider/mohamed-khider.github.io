"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import NotificationModal from "../components/NotificationModal";
import PageHeader from "../components/PageHeader";
import { sendZplToPrinter } from "../lib/printService";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { addPrintHistory, getPrintHistoryByType, initializePrintHistory, PrintHistoryEntry } from "../lib/printHistory";

const suffixes = ["A", "B", "C", "D", "E"];

export default function SectionPage() {
  const [cValue, setCValue] = useState("");
  const [sValue, setSValue] = useState("");
  const [level, setLevel] = useState("");
  const [printerIp, setPrinterIp] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [printHistory, setPrintHistory] = useState<PrintHistoryEntry[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const svgRefs = useRef<Array<SVGSVGElement | null>>([]);

  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");

  const base = useMemo(() => {
    return `${cValue.trim().toUpperCase()}-${sValue.trim().toUpperCase()}`;
  }, [cValue, sValue]);

  const loadHistory = () => {
    initializePrintHistory();
    setPrintHistory(getPrintHistoryByType("section"));
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
      openNotification("Copied", "Section ZPL copied to clipboard.", "success");
    } catch (error) {
      openNotification("Copy Failed", String(error), "warning");
    }
  };

  const handleGenerate = () => {
    if (!cValue.trim() || !sValue.trim() || !level) {
      openNotification("Missing fields", "All fields are required before generating section labels.", "warning");
      return;
    }

    setCodes(suffixes.map((suffix) => `RML-${base}-L${level}${suffix}`));
  };

  const zplText = useMemo(() => {
    if (!codes.length) {
      return "";
    }

    let y = 60;
    let zpl = `^XA\n^PW812\n^LL1218\n^BY3,2,120\n\n`;

    codes.forEach((code) => {
      const levelCode = code.split("-").pop();
      zpl += `^FO100,${y}\n^BCN,120,Y,N,N\n^FD${code}^FS\n\n^FO710,${y + 100}\n^A0N,60,60\n^FD${levelCode}^FS\n\n`;
      y += 200;
    });

    zpl += "^XZ";
    return zpl;
  }, [codes]);

  const handlePrint = async () => {
    if (!codes.length) {
      openNotification("Nothing to Print", "Generate labels before printing.", "warning");
      return;
    }

    if (!canPrint) {
      openNotification("Permission Required", "Your account does not have permission to print section labels.", "warning");
      return;
    }

    setIsPrinting(true);

    try {
      await sendZplToPrinter(zplText);
      addPrintHistory({
        type: "section",
        title: "Section labels printed",
        location: `RML-${base}`,
        codes,
        printerIp: printerIp || undefined,
        action: "printed",
        user: currentUser?.username || "anonymous"
      });
      loadHistory();
      openNotification("Printed Successfully", "Section labels were sent to your printer.", "success");
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
        type: "section",
        title: "Section ZPL sent",
        location: `RML-${base}`,
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

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Section Label Generator"
          subtitle="Build section labels with a consistent RML code structure."
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
            <label htmlFor="sInput">S value</label>
            <input
              id="sInput"
              type="text"
              value={sValue}
              onChange={(event) => setSValue(event.target.value)}
              placeholder="e.g. 01"
            />
          </div>

          <div className="form-field">
            <label htmlFor="levelSelect">Level</label>
            <select
              id="levelSelect"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">Select level</option>
              <option value="1">L1</option>
              <option value="2">L2</option>
              <option value="3">L3</option>
              <option value="4">L4</option>
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
            <h2>Barcode Preview</h2>
            <div className="preview-grid" id="print-only">
              {codes.map((code, index) => {
                const levelCode = code.split("-").pop();
                return (
                  <div key={code} className="label-card" style={{ position: "relative" }}>
                    <svg
                      ref={(element) => {
                        svgRefs.current[index] = element;
                        if (element) {
                          JsBarcode(element, code, {
                            format: "CODE128",
                            width: 3,
                            height: 100,
                            displayValue: true,
                            fontSize: 18,
                            margin: 0,
                          });
                        }
                      }}
                    />
                    <div className="label-value">{levelCode}</div>
                  </div>
                );
              })}
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
            <p style={{ color: "#6b7280", marginTop: "12px" }}>No section print history yet. Print or send a label to create the first record.</p>
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
