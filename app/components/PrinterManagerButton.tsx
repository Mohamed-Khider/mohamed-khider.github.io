"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addPrinterProfile,
  getDefaultPrinterProfile,
  getPrinterProfiles,
  initializePrinterProfiles,
  type PrinterProfile,
  updatePrinterProfile,
} from "../lib/labelManagement";
import { fetchLocalFirst, fetchLocalPrintService } from "../lib/localPrintBridge";

interface SystemPrinter {
  Name: string;
  DriverName?: string;
  PortName?: string;
  PrinterStatus?: number;
  Shared?: boolean;
  ShareName?: string;
}

export default function PrinterManagerButton() {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [defaultSystemPrinter, setDefaultSystemPrinter] = useState("");
  const [serviceRunning, setServiceRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initializePrinterProfiles();
    setProfiles(getPrinterProfiles());
  }, []);

  const defaultProfile = useMemo(
    () => profiles.find((profile) => profile.default) || null,
    [profiles]
  );

  const displayName =
    defaultProfile?.address || defaultProfile?.name || defaultSystemPrinter || "Printer";

  async function checkServiceStatus() {
    const response = await fetchLocalPrintService("/health");
    const running = Boolean(response?.ok);
    setServiceRunning(running);
    return running;
  }

  async function loadPrinters() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetchLocalFirst("/api/printers");
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to load installed printers.");
      }

      setSystemPrinters(json.data || []);
      setDefaultSystemPrinter(json.defaultPrinterName || "");
      await checkServiceStatus();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function selectSystemPrinter(printerName: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetchLocalFirst("/api/printers/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: printerName }),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to set Windows default printer.");
      }

      const existing = getPrinterProfiles().find(
        (profile) => profile.connectionMethod === "system" && profile.address === printerName
      );

      if (existing) {
        updatePrinterProfile(existing.id, { default: true });
      } else {
        addPrinterProfile({
          name: printerName,
          connectionMethod: "system",
          address: printerName,
          default: true,
        });
      }

      setProfiles(getPrinterProfiles());
      setDefaultSystemPrinter(printerName);
      setMessage(`${printerName} is now the default Zebra printer.`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function requestServiceInstall() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/local-print-service/install", {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to request Windows service installation.");
      }

      setMessage(json.message || "Approve the Windows prompt to install the print service.");
    } catch (error) {
      setMessage(
        `${String(error)} Run npm run print-service:install from this project to install it manually.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestUsbAccess() {
    setMessage("");

    if (typeof navigator === "undefined" || !("usb" in navigator)) {
      setMessage("WebUSB is not available in this browser. Use the desktop app or Windows driver printer.");
      return;
    }

    try {
      const usb = navigator.usb as any;
      const device = await usb.requestDevice({
        filters: [{ vendorId: 0x0a5f }, { vendorId: 0x0493 }],
      });
      setMessage(`USB access granted for ${device.productName || "selected printer"}.`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  useEffect(() => {
    if (open && systemPrinters.length === 0 && !loading) {
      loadPrinters();
    }

    if (open) {
      checkServiceStatus();
    }
  }, [open]);

  return (
    <div className="printer-manager">
      <button
        className="printer-manager-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Printer management"
        aria-label="Printer management"
      >
        <span className="material-symbols-outlined">print</span>
        <span className="printer-manager-label">{displayName}</span>
      </button>

      {open && (
        <div className="printer-popover">
          <div className="printer-popover-header">
            <div>
              <strong>Printer Management</strong>
              <span>
                {serviceRunning ? "Local service running" : "Local service not running"}
                {" | "}
                {defaultProfile ? `Default: ${displayName}` : "No default selected"}
              </span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close printer management">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="printer-actions">
            <button className="ghost-button" type="button" onClick={loadPrinters} disabled={loading}>
              <span className="material-symbols-outlined">refresh</span>
              {loading ? "Loading" : "Load"}
            </button>
            <button className="ghost-button" type="button" onClick={requestUsbAccess}>
              <span className="material-symbols-outlined">usb</span>
              USB Access
            </button>
            <button className="ghost-button" type="button" onClick={requestServiceInstall} disabled={loading || serviceRunning}>
              <span className="material-symbols-outlined">admin_panel_settings</span>
              Service
            </button>
          </div>

          <div className="printer-list">
            {systemPrinters.length === 0 ? (
              <p>{loading ? "Searching installed printers..." : "No installed printers loaded."}</p>
            ) : (
              systemPrinters.map((printer) => {
                const isDefault =
                  printer.Name === defaultSystemPrinter || printer.Name === getDefaultPrinterProfile()?.address;

                return (
                  <button
                    className={`printer-list-item ${isDefault ? "active" : ""}`}
                    key={printer.Name}
                    type="button"
                    onClick={() => selectSystemPrinter(printer.Name)}
                    disabled={loading}
                  >
                    <span className="material-symbols-outlined">{isDefault ? "check_circle" : "print"}</span>
                    <span>
                      <strong>{printer.Name}</strong>
                      <small>{printer.DriverName || printer.PortName || "Windows printer"}</small>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {message && <p className="printer-message">{message}</p>}
        </div>
      )}
    </div>
  );
}
