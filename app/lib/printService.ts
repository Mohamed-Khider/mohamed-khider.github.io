import { getDefaultPrinterProfile } from "./labelManagement";

export type ConnectionMethod = "wifi" | "usb" | "bluetooth" | "system";

export interface PrinterConnectionOptions {
  method?: ConnectionMethod;
  address?: string;
  printerName?: string;
}

export async function sendZplToPrinter(
  zpl: string,
  connection?: string | PrinterConnectionOptions
) {
  const connectionOptions: PrinterConnectionOptions =
    typeof connection === "string"
      ? { method: "wifi", address: connection }
      : connection || getDefaultPrinterConnection();

  switch (connectionOptions.method) {
    case "system":
      return sendZplViaSystemPrinter(
        zpl,
        connectionOptions.printerName || connectionOptions.address
      );
    case "usb":
      return sendZplViaUsb(zpl);
    case "bluetooth":
      return sendZplViaBluetooth(zpl);
    case "wifi":
    default:
      return sendZplViaWifi(zpl, connectionOptions.address);
  }
}

function getDefaultPrinterConnection(): PrinterConnectionOptions {
  const defaultProfile = getDefaultPrinterProfile();
  if (!defaultProfile) return { method: "wifi" };

  return {
    method: defaultProfile.connectionMethod,
    address: defaultProfile.address,
    printerName: defaultProfile.address || defaultProfile.name,
  };
}

async function sendZplViaSystemPrinter(zpl: string, printerName?: string) {
  const payload = { zpl, printerName };
  const localServiceUrl = "http://127.0.0.1:3001/api/printers/zpl";

  const localResponse = await fetch(localServiceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (localResponse?.ok) return;

  const response = await fetch("/api/printers/zpl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error ||
        "Unable to send ZPL to the selected Windows printer."
    );
  }
}

async function sendZplViaWifi(zpl: string, printerIp?: string) {
  const response = await fetch("/api/print-zpl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zpl, printerIp }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    if (response.status === 404) {
      throw new Error(
        "Network printer API is unavailable on this static deployment. Use USB printing, browser/PDF print, or deploy the app with a server runtime for WiFi ZPL printing."
      );
    }
    throw new Error(errorData?.error || response.statusText);
  }
}

async function sendZplViaUsb(zpl: string) {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error("WebUSB is not supported by this browser.");
  }

  const usb = navigator.usb as any;
  const filters = [
    { vendorId: 0x0a5f },
    { vendorId: 0x0493 },
  ];

  const device = await usb.requestDevice({ filters });
  if (!device) {
    throw new Error("No USB Zebra printer selected.");
  }

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const interfaceItem = device.configuration.interfaces.find(
    (item: any) =>
      item.alternates.some(
        (alt: any) => alt.interfaceClass === 7 || alt.interfaceClass === 0
      )
  );

  if (!interfaceItem) {
    throw new Error("No suitable USB printer interface found.");
  }

  const interfaceNumber = interfaceItem.interfaceNumber;
  await device.claimInterface(interfaceNumber);

  const alternate = interfaceItem.alternates.find(
    (alt: any) => alt.endpoints.some((ep: any) => ep.direction === "out")
  );

  const endpoint = alternate?.endpoints.find(
    (ep: any) => ep.direction === "out"
  );

  if (!endpoint) {
    throw new Error("USB output endpoint not found.");
  }

  const data = new TextEncoder().encode(zpl + "\n");
  await device.transferOut(endpoint.endpointNumber, data);
  await device.releaseInterface(interfaceNumber);
  await device.close();
}

async function sendZplViaBluetooth(zpl: string) {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
    throw new Error("Web Bluetooth is not supported by this browser.");
  }

  const bluetooth = navigator.bluetooth as any;
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["battery_service"],
  });

  if (!device) {
    throw new Error("No Bluetooth printer selected.");
  }

  throw new Error(
    "Bluetooth printing requires a dedicated browser integration. Use WiFi or USB for best Zebra printer support."
  );
}
