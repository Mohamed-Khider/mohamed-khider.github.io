"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import NotificationModal from "../components/NotificationModal";
import PageHeader from "../components/PageHeader";
import { sendZplToPrinter } from "../lib/printService";
import { getCurrentUser, hasPermission } from "../lib/userManagement";

export default function GenerateBarcodePage() {
  const [value, setValue] = useState("");
  const [printerIp, setPrinterIp] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");

  useEffect(() => {
    if (!value || !svgRef.current) {
      return;
    }

    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      width: 2,
      height: 80,
      displayValue: false,
      margin: 0,
    });
  }, [value]);

  const zplText = value
    ? `^XA\n^BY3,2,100\n^FO50,50^BCN,100,Y,N,N\n^FD${value}^FS\n^FO50,180^A0N,40,40\n^FD${value}^FS\n^XZ`
    : "";

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "warning") => {
    setNotification({ title, message, type });
  };

  const handlePrint = async () => {
    if (!value) {
      openNotification("No Value", "Enter a barcode value before printing.", "warning");
      return;
    }

    if (!canPrint) {
      openNotification("Permission Required", "Your account does not have permission to print labels.", "warning");
      return;
    }

    if (!confirm(`Print label for: ${value}?`)) return;
    setIsPrinting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.print();
      openNotification("Printed Successfully", "Your barcode label was sent to the printer.", "success");
    } catch (error) {
      openNotification("Print Failed", String(error), "warning");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendToZebra = async () => {
    if (!zplText) {
      openNotification("No ZPL Output", "Enter a barcode value before sending to the Zebra printer.", "warning");
      return;
    }

    if (!canPrint) {
      openNotification("Permission Required", "Your account does not have permission to send labels to the Zebra printer.", "warning");
      return;
    }

    setIsSending(true);

    try {
      await sendZplToPrinter(zplText, printerIp || undefined);
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
          title="Single Barcode Generator"
          subtitle="Create one barcode label and print it directly."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <div className="form-field">
            <label htmlFor="labelInput">Scan or enter a code</label>
            <input
              id="labelInput"
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Enter code here"
              autoFocus
            />
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

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button
              className="primary-button"
              type="button"
              disabled={!value.trim() || isPrinting || !canPrint}
              onClick={handlePrint}
            >
              {isPrinting ? "Printing..." : "Print Label"}
            </button>
            <button
              className="second-button"
              type="button"
              disabled={!value.trim() || isSending || isPrinting || !canPrint}
              onClick={handleSendToZebra}
            >
              {isSending ? "Sending to Zebra..." : "Send to Zebra Printer"}
            </button>
          </div>
          {!canPrint && (
            <div className="warning-banner">
              Your account does not have print permission. Contact an administrator to enable printer access.
            </div>
          )}
        </div>

        <div className="card preview-panel" id="print-only">
          <h2>Label Preview</h2>
          {value ? (
            <div className="label-card">
              <svg ref={svgRef} />
              <div className="label-value">{value}</div>
            </div>
          ) : (
            <p>Enter a value to generate a live preview.</p>
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
