"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import NotificationModal from "../components/NotificationModal";
import { getCurrentUser, hasPermission } from "../lib/userManagement";
import { getPrinterProfiles, initializePrinterProfiles, getDefaultPrinterProfile, buildZpl, LabelTemplateType, PrinterProfile } from "../lib/labelManagement";
import { sendZplToPrinter } from "../lib/printService";
import PalletPage from "../pallet/page";

const defaultTemplate = "single" as LabelTemplateType;

export default function LabelsPage() {
  const currentUser = getCurrentUser();
  const canPrint = hasPermission(currentUser, "print_labels");

  const [template, setTemplate] = useState<LabelTemplateType>(defaultTemplate);
  const [value, setValue] = useState("");
  const [palletCode, setPalletCode] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [printerProfileId, setPrinterProfileId] = useState("");
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: "warning" | "success" | "info" } | null>(null);

  useEffect(() => {
    initializePrinterProfiles();
    const saved = getPrinterProfiles();
    setProfiles(saved);
    const defaultProfile = getDefaultPrinterProfile();
    setPrinterProfileId(defaultProfile?.id ?? "");
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === printerProfileId) || getDefaultPrinterProfile(),
    [printerProfileId, profiles]
  );

  const zplText = useMemo(() => {
    return buildZpl(template, {
      value: value.trim() || "ITEM-000",
      palletCode: palletCode.trim() || "PLT-001",
      sectionCode: sectionCode.trim() || "SEC-A1",
    });
  }, [template, value, palletCode, sectionCode]);

  const openNotification = (title: string, message: string, type: "warning" | "success" | "info" = "info") => {
    setNotification({ title, message, type });
  };

  const handleSendToPrinter = async () => {
    if (!canPrint) {
      openNotification("Permission Denied", "Your account does not have permission to print labels.", "warning");
      return;
    }

    if (!activeProfile?.printerIp) {
      openNotification("Printer Missing", "Select a printer profile with an IP address.", "warning");
      return;
    }

    setIsSending(true);

    try {
      await sendZplToPrinter(zplText, activeProfile?.printerIp);
      openNotification("Label Sent", "The label was sent to the selected printer.", "success");
    } catch (err) {
      openNotification("Printer Error", err instanceof Error ? err.message : "Failed to send label.", "warning");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Label Management"
          subtitle="Create and dispatch warehouse labels from a single interface."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <div style={{ display: "grid", gap: 20 }}>
            <div className="form-field">
              <label htmlFor="label-template">Label Template</label>
              <select id="label-template" value={template} onChange={(event) => setTemplate(event.target.value as LabelTemplateType)}>
                <option value="single">Single Barcode</option>
                <option value="pallet">Pallet Label</option>
                <option value="section">Section Label</option>
              </select>
            </div>

            {template === "single" && (
              <div className="form-field">
                <label htmlFor="label-value">Label Value</label>
                <input
                  id="label-value"
                  type="text"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Enter code or SKU"
                />
              </div>
            )}

            {template === "pallet" && (
              // <div className="form-field">
              //   <label htmlFor="pallet-code">Pallet Code</label>
              //   <input
              //     id="pallet-code"
              //     type="text"
              //     value={palletCode}
              //     onChange={(event) => setPalletCode(event.target.value)}
              //     placeholder="Enter pallet identifier"
              //   />
              // </div>
              <PalletPage/>
            )}

            {template === "section" && (
              <div className="form-field">
                <label htmlFor="section-code">Section Code</label>
                <input
                  id="section-code"
                  type="text"
                  value={sectionCode}
                  onChange={(event) => setSectionCode(event.target.value)}
                  placeholder="Enter section location"
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="printer-profile">Printer Profile</label>
              <select
                id="printer-profile"
                value={printerProfileId}
                onChange={(event) => setPrinterProfileId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} — {profile.printerIp}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <button className="primary-button" type="button" onClick={handleSendToPrinter} disabled={!canPrint || isSending}>
                {isSending ? "Sending..." : "Send to Printer"}
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Label Preview</h3>
          <pre className="pre-code">{zplText}</pre>
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
