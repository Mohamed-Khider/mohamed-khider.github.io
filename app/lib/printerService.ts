import { execFileSync } from "child_process";

export function getPrinters() {
  try {
    const output = runPowerShell(
      "Get-Printer | Select Name,DriverName,PortName,PrinterStatus,Shared,ShareName | ConvertTo-Json -Depth 2"
    );

    if (!output || output.trim() === "") return [];

    const parsed = JSON.parse(output);

    // ensure always array
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Printer fetch error:", error);
    return [];
  }
}

export function getDefaultPrinterName(): string | null {
  try {
    const output = runPowerShell(
      "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)"
    );
    return output.trim() || null;
  } catch (error) {
    console.error("Default printer fetch error:", error);
    return null;
  }
}

export function setDefaultPrinter(printerName: string) {
  try {
    runPowerShell(
  `"param([string]$Name) Set-Printer -Name ${printerName} -IsDefault $true"`,
  [printerName]
);
    return true;
  } catch (error) {
    console.error("Set default printer error:", error);
    return false;
  }
}

export function printTest(printerName: string) {
  try {
    sendRawZplToPrinter(
      printerName,
      "^XA^FO30,30^A0N,36,36^FDWarehouse Zebra test^FS^XZ"
    );
    return true;
  } catch (error) {
    console.error("Print error:", error);
    return false;
  }
}

export function sendRawZplToPrinter(printerName: string, zpl: string) {
  if (!printerName?.trim()) {
    throw new Error("Printer name is required.");
  }

  if (!zpl?.trim()) {
    throw new Error("ZPL payload is required.");
  }

  const script = String.raw`
param(
  [string]$PrinterName,
  [string]$Base64Zpl
)

$source = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA
  {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);

  public static bool SendBytesToPrinter(string printerName, byte[] bytes)
  {
    IntPtr printerHandle;
    DOCINFOA docInfo = new DOCINFOA();
    docInfo.pDocName = "ZPL Label";
    docInfo.pDataType = "RAW";

    if (!OpenPrinter(printerName.Normalize(), out printerHandle, IntPtr.Zero)) return false;

    bool success = false;
    if (StartDocPrinter(printerHandle, 1, docInfo))
    {
      if (StartPagePrinter(printerHandle))
      {
        int written;
        success = WritePrinter(printerHandle, bytes, bytes.Length, out written);
        EndPagePrinter(printerHandle);
      }
      EndDocPrinter(printerHandle);
    }

    ClosePrinter(printerHandle);
    return success;
  }
}
"@

Add-Type -TypeDefinition $source
$bytes = [Convert]::FromBase64String($Base64Zpl)
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
if (-not $ok) {
  throw "Unable to write RAW ZPL to printer '$PrinterName'."
}
`;

  runPowerShell(script, [
    printerName,
    Buffer.from(zpl, "utf8").toString("base64"),
  ]);
}

function runPowerShell(command: string, args: string[] = []) {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command, ...args],
    { encoding: "utf-8", windowsHide: true }
  );
}
