import { NextResponse } from "next/server";
import { setDefaultPrinter } from "../../../lib/printerService";

export async function POST(req: Request) {
  const { name } = await req.json();

  const success = setDefaultPrinter(name);

  return NextResponse.json({ success:success });
}