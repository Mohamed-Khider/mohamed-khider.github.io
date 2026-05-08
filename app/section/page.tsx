"use client";

import { useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import { sendZplToPrinter } from "../lib/printService";

const suffixes = ["A", "B", "C", "D", "E"];

export default function SectionPage() {
  const [cValue, setCValue] = useState("");
  const [sValue, setSValue] = useState("");
  const [level, setLevel] = useState("");
  const [printerIp, setPrinterIp] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const svgRefs = useRef<Array<SVGSVGElement | null>>([]);

  const base = useMemo(() => {
    return `${cValue.trim().toUpperCase()}-${sValue.trim().toUpperCase()}`;
  }, [cValue, sValue]);

  const handleGenerate = () => {
    if (!cValue.trim() || !sValue.trim() || !level) {
      alert("All fields are required.");
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

  const [isSending, setIsSending] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendToZebra = async () => {
    if (!zplText) {
      alert("Generate labels before sending to the Zebra printer.");
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
            <h1>Section Label Generator</h1>
            <p>Build section labels with a consistent RML code structure.</p>
          </div>
        </div>

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

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button className="primary-button" type="button" onClick={handleGenerate}>
              Generate
            </button>
            <button className="second-button" type="button" onClick={handlePrint}>
              Print Label
            </button>
            <button
              className="second-button"
              type="button"
              onClick={handleSendToZebra}
              disabled={isSending}
            >
              {isSending ? "Sending to Zebra..." : "Send to Zebra Printer"}
            </button>
          </div>
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
      </div>
    </ProtectedPage>
  );
}
