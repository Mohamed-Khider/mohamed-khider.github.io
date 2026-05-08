"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import { sendZplToPrinter } from "../lib/printService";

export default function GenerateBarcodePage() {
  const [value, setValue] = useState("");
  const [printerIp, setPrinterIp] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);

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

  const [isSending, setIsSending] = useState(false);

  const zplText = value
    ? `^XA\n^BY3,2,100\n^FO50,50^BCN,100,Y,N,N\n^FD${value}^FS\n^FO50,180^A0N,40,40\n^FD${value}^FS\n^XZ`
    : "";

  const handlePrint = () => {
    if (!value) return;
    if (!confirm(`Print label for: ${value}?`)) return;
    window.print();
  };

  const handleSendToZebra = async () => {
    if (!zplText) {
      alert("Enter a barcode value before sending to the Zebra printer.");
      return;
    }

    setIsSending(true);

    try {
      await sendZplToPrinter(zplText, printerIp || undefined);
      alert("ZPL sent to the Zebra printer via server.");
    } catch (error) {
      alert(String(error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Single Barcode Generator</h1>
            <p>Create one barcode label and print it directly.</p>
          </div>
        </div>

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
              disabled={!value.trim()}
              onClick={handlePrint}
            >
              Print Label
            </button>
            <button
              className="second-button"
              type="button"
              disabled={!value.trim() || isSending}
              onClick={handleSendToZebra}
            >
              {isSending ? "Sending to Zebra..." : "Send to Zebra Printer"}
            </button>
          </div>
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
      </div>
    </ProtectedPage>
  );
}
