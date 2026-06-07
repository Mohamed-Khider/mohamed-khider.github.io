import { NextResponse } from "next/server";
import { setDefaultPrinter } from "../../../lib/printerService";

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    console.log("api/printers/default"+`Received request to set default printer to: ${name}`);
    if (!name || typeof name !== "string") {
      return NextResponse.json({ success: false, error: "Printer name is required." }, { status: 400 });
    }

    const success = setDefaultPrinter(name);

    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
