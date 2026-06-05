const { execFile, execFileSync } = require("child_process");

function runPowerShell(command, args = []) {
  return execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& { " + command + " }",
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
    }
  );
}

function runPowerShellAsync(command, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command, ...args],
      { encoding: "utf-8", windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function getPrinters() {
  const output = runPowerShell(
    "Get-Printer | Select Name,DriverName,PortName,PrinterStatus,Shared,ShareName | ConvertTo-Json -Depth 2"
  );

  if (!output || output.trim() === "") return [];

  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// function getDefaultPrinterName() {
//   const output = runPowerShell(
//     "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)"
//   );
//   return output.trim() || null;
// }


// function setDefaultPrinter(printerName) {
//   const escaped = printerName.replace(/'/g, "''");

//   runPowerShell(`
//     Set-Printer -Name '${escaped}' -IsDefault $true
//   `);
// }


function setDefaultPrinter(printerName) {
  const escaped = printerName.replace(/'/g, "''");

  runPowerShell(`
    (New-Object -ComObject WScript.Network)
      .SetDefaultPrinter('${escaped}')
  `);
}


function setDefaultPrinter(printerName) {
  runPowerShell(
    "param([string]$Name) Start-Process -FilePath 'rundll32.exe' -ArgumentList @('printui.dll,PrintUIEntry','/y','/n', $Name) -Wait",
    [printerName]
  );
}

async function setDefaultPrinterAsync(printerName) {
  await runPowerShellAsync(
    "param([string]$Name) Start-Process -FilePath 'rundll32.exe' -ArgumentList @('printui.dll,PrintUIEntry','/y','/n', $Name) -Wait",
    [printerName]
  );
}

function sendRawZplToPrinter(printerName, zpl) {
  if (!printerName || !printerName.trim()) {
    throw new Error("Printer name is required.");
  }

  if (!zpl || !zpl.trim()) {
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

function printTest(printerName) {
  sendRawZplToPrinter(
    printerName,
    "^XA^FO30,30^A0N,36,36^FDWarehouse Zebra test^FS^XZ"
  );
}

module.exports = {
  getDefaultPrinterName,
  getPrinters,
  printTest,
  sendRawZplToPrinter,
  setDefaultPrinter,
  setDefaultPrinterAsync,
};
