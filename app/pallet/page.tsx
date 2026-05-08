"use client";

import { useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import ProtectedPage from "../components/ProtectedPage";
import { sendZplToPrinter } from "../lib/printService";

const rangeOne = ["01", "02", "03", "04", "05", "06"];
const rangeTwo = ["07", "08", "09", "10"];

export default function PalletPage() {
  const [cValue, setCValue] = useState("");
  const [range, setRange] = useState("1");
  const [codes, setCodes] = useState<string[]>([]);
  const [printerIp, setPrinterIp] = useState("");
  const svgRefs = useRef<Array<SVGSVGElement | null>>([]);

  const base = useMemo(() => `${cValue.trim().toUpperCase()}-PLT`, [cValue]);

  const handleGenerate = () => {
    const normalizedC = cValue.trim().toUpperCase();
    if (!normalizedC) {
      alert("Enter a C value first.");
      return;
    }

    const suffixes = range === "1" ? rangeOne : rangeTwo;
    setCodes(suffixes.map((suffix) => `${base}-${suffix}`));
  };

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
        <div className="page-header">
          <div>
            <h1>Pallet Label Generator</h1>
            <p>Generate pallet barcode labels and preview the ZPL output.</p>
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

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button className="primary-button" type="button" onClick={handleGenerate}>
              Generate
            </button>
            <button className="second-button" type="button" onClick={handlePrint}>
              Print Labels
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
      </div>
    </ProtectedPage>
  );
}
