import { NextResponse } from "next/server";
import { printTest } from "../../../lib/printerService";

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ success: false, error: "Printer name is required." }, { status: 400 });
    }

    const success = printTest(name);

    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}
