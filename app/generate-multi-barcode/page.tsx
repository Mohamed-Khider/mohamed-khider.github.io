"use client";

import { useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ProtectedPage from "../components/ProtectedPage";
import NotificationModal from "../components/NotificationModal";
import PageHeader from "../components/PageHeader";

export default function GenerateMultiBarcodePage() {
  const [input, setInput] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleGenerate = () => {
    const values = input
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    setCodes(values);
  };

  const handleDownloadPDF = async () => {
    if (!containerRef.current || codes.length === 0) {
      return;
    }

    const canvas = await html2canvas(containerRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save("barcodes.pdf");
  };

  const multiZplText = useMemo(() => {
    if (!codes.length) {
      return "";
    }

    let y = 40;
    let zpl = `^XA\n^PW812\n^LL1218\n^BY3,2,100\n\n`;

    codes.forEach((code) => {
      zpl += `^FO50,${y}\n^BCN,100,Y,N,N\n^FD${code}^FS\n\n`;
      y += 180;
    });

    zpl += "^XZ";
    return zpl;
  }, [codes]);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleCopyZpl = async () => {
    if (!multiZplText) {
      openNotification("No ZPL Output", "Generate barcodes before copying ZPL.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(multiZplText);
      openNotification("Copied", "Multi-barcode ZPL copied to clipboard.", "success");
    } catch (error) {
      openNotification("Copy Failed", String(error), "warning");
    }
  };

  const handlePrint = async () => {
    if (codes.length === 0) {
      openNotification("Nothing to Print", "Generate barcode labels before printing.", "warning");
      return;
    }

    setIsPrinting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.print();
      openNotification("Printed Successfully", "Your barcode labels were sent to the printer.", "success");
    } catch (error) {
      openNotification("Print Failed", String(error), "warning");
    } finally {
      setIsPrinting(false);
    }
  };

  const preview = useMemo(
    () => codes.length > 0,
    [codes]
  );

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Multi Barcode Generator"
          subtitle="Paste a list of codes and generate printable barcode labels."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <div className="form-field">
            <label htmlFor="barcodeList">Barcode list</label>
            <textarea
              id="barcodeList"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste one barcode value per line..."
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
            <button className="second-button" type="button" onClick={handleDownloadPDF} disabled={!codes.length}>
              Download PDF
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div>
              <h2>Label Grid Preview</h2>
              <p className="subtle-text">Review your barcode labels before printing or exporting.</p>
            </div>
          </div>
          {preview ? (
            <div ref={containerRef} className="preview-grid" id="print-only">
              {codes.map((code) => (
                <div key={code} className="label-card">
                  <svg
                    ref={(element) => {
                      if (element) {
                        JsBarcode(element, code, {
                          format: "CODE128",
                          width: 1.5,
                          height: 40,
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
          ) : (
            <p>Generate labels to preview your barcode grid.</p>
          )}
          <div style={{ marginTop: 24 }}>
            <h2>ZPL Output</h2>
            <pre className="pre-code">{multiZplText || "Generate labels to view ZPL output."}</pre>
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
