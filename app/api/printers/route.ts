import { NextResponse } from "next/server";
import { getDefaultPrinterName, getPrinters } from "../../lib/printerService";

export async function GET() {
  try {
    const printers = getPrinters();

    return NextResponse.json({
      success: true,
      data: printers ?? [],
      defaultPrinterName: getDefaultPrinterName(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: [],
      error: String(error),
    });
  }
}
