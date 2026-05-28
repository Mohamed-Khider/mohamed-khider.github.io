import { execSync } from "child_process";

export function getPrinters() {
  try {
    const output = execSync(
      `powershell -Command "Get-Printer | Select Name,DriverName,PortName,PrinterStatus | ConvertTo-Json -Depth 2"`,
      { encoding: "utf-8" }
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

export function setDefaultPrinter(printerName: string) {
  try {
    const command = `
      powershell -Command "Start-Process -FilePath 'rundll32.exe' -ArgumentList 'printui.dll,PrintUIEntry /y /n \\"${printerName}\\"'"
    `;

    execSync(command, { stdio: "ignore" });

    return true;
  } catch (error) {
    console.error("Set default printer error:", error);
    return false;
  }
}

export function printTest(printerName: string) {
  try {
    execSync(
      `powershell -Command "Start-Process -FilePath notepad.exe -ArgumentList '/p' -NoNewWindow"`
    );
    return true;
  } catch (error) {
    console.error("Print error:", error);
    return false;
  }
}