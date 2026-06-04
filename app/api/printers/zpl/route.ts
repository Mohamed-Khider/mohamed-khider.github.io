import { NextResponse } from "next/server";
import { getDefaultPrinterName, sendRawZplToPrinter } from "../../../lib/printerService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const zpl = body?.zpl;
    const printerName = body?.printerName || getDefaultPrinterName();

    if (!zpl || typeof zpl !== "string") {
      return NextResponse.json({ error: "Missing ZPL payload." }, { status: 400 });
    }

    if (!printerName || typeof printerName !== "string") {
      return NextResponse.json(
        { error: "No Windows default printer is selected." },
        { status: 400 }
      );
    }

    sendRawZplToPrinter(printerName, zpl);

    return NextResponse.json({
      success: true,
      printerName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
