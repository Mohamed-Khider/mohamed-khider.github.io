"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedPage from "../components/ProtectedPage";
import PageHeader from "../components/PageHeader";
import {
  addPrinterProfile,
  getPrinterProfiles,
  initializePrinterProfiles,
  type PrinterConnectionMethod,
  type PrinterProfile,
  updatePrinterProfile,
} from "../lib/labelManagement";
 

const connectionMethods: PrinterConnectionMethod[] = ["system", "wifi", "usb", "bluetooth"];

export default function PrinterSettingsPage() {
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<PrinterConnectionMethod>("wifi");
  const [systemPrinters, setSystemPrinters] = useState<any[]>([]);

  useEffect(() => {
    initializePrinterProfiles();
    const profiles = getPrinterProfiles();
    setPrinterProfiles(profiles);
  }, []);

  const filteredProfiles = useMemo(
    () =>
      printerProfiles.filter((profile) =>
        [profile.name, profile.address, profile.connectionMethod]
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [printerProfiles, searchQuery]
  );

  const handleAddProfile = () => {
    if (!name.trim() || (!address.trim() && method === "wifi")) {
      return;
    }
    const newProfile = addPrinterProfile({
      name: name.trim(),
      connectionMethod: method,
      address: method === "system" ? address.trim() || name.trim() : address.trim(),
      default: false,
    });
    setPrinterProfiles((current) => [...current, newProfile]);
    setName("");
    setAddress("");
    setMethod("wifi");
  };

//   async function requestDevice() {
//   try {
//     const device = await navigator.us.requestDevice({ filters: [] });
//     console.log(device);
//   } catch (e) {
//     console.error(e);
//   }
// }

// async function getDevices() {
//   const devices = await navigator.usb.getDevices();
//   devices.forEach((device) => {
//     console.log(`Name: ${device.productName}, Serial: ${device.serialNumber}`);
//   });
//   return devices;
// }


async function loadPrinters() {
  try {
    const res = await fetch("/api/printers");

    if (!res.ok) {
      throw new Error("API failed");
    }

    const text = await res.text();

    if (!text) {
      console.warn("Empty response");
      return;
    }

    const json = JSON.parse(text);

    setSystemPrinters(json.data || []);
  } catch (err) {
    console.error("Failed to load printers:", err);
  }
}

  const handleSetDefault = async (profileId: string) => {
    const success = updatePrinterProfile(profileId, { default: true });
    if (!success) return;
    const profiles = getPrinterProfiles();
    setPrinterProfiles(profiles);
  };

  return (
    <ProtectedPage>
      <div className="container">
        <PageHeader
          title="Printer Settings"
          subtitle="Configure Zebra printer profiles and select the default transport method."
          showBack={true}
          showLogout={true}
        />

        <div className="card">
          <h3>Default Printer Profile</h3>
          <p style={{ marginBottom: 16 }}>
            Use this page to search for your printer profile, define a default Zebra connection, and configure WiFi/USB/Bluetooth addresses.
          </p>

          <div className="form-field">
            <label>Search Profiles</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, address, or transport"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginTop: 20,
            }}
          >
            <div className="form-field">
              <label>Printer Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zebra Office Printer"
              />
            </div>
            <div className="form-field">
              <label>Connection Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PrinterConnectionMethod)}>
                {connectionMethods.map((connectionMethod) => (
                  <option key={connectionMethod} value={connectionMethod}>
                    {connectionMethod.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: "span 2" }}>
              <label>Address / IP</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={method === "wifi" ? "192.168.1.100" : "Windows printer name or optional device address"}
              />
            </div>
           <button
  className="second-button"
  onClick={loadPrinters}
  style={{ gridColumn: "span 2" }}
>
  Load Installed Printers
</button>

<div className="card">
  <h3>Detected System Printers</h3>

  {systemPrinters.map((p, i) => (
    <div key={i} style={{ padding: 10, borderBottom: "1px solid #eee" }}>
      <strong>{p.Name}</strong>
      <p>{p.DriverName}</p>

      <button
        onClick={async () => {
          await fetch("/api/printers/default", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: p.Name }),
          });
          alert("Set as default");
        }}
      >
        Set as Default
      </button>

      <button
        onClick={async () => {
          await fetch("/api/printers/print", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: p.Name }),
          });
        }}
      >
        Test Print
      </button>
    </div>
  ))}
</div>
          </div>

          <button className="primary-button" onClick={handleAddProfile} type="button" style={{ marginTop: 16 }}>
            Add Printer Profile
          </button>

          
        </div>


        <div className="card">
          <h3>Saved Printer Profiles</h3>
          {filteredProfiles.length === 0 ? (
            <p>No printer profiles found. Create one above.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                  }}
                >
                  <div>
                    <strong>{profile.name}</strong>
                    <p style={{ margin: "4px 0" }}>
                      Method: {profile.connectionMethod} • Address: {profile.address || "N/A"}
                    </p>
                    {profile.default && (
                      <span style={{ color: "#047857", fontWeight: 600 }}>Default profile</span>
                    )}
                  </div>
                  {!profile.default && (
                    <button
                      className="second-button"
                      type="button"
                      onClick={() => handleSetDefault(profile.id)}
                    >
                      Set Default
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
