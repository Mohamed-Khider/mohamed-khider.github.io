import { NextResponse } from "next/server";
import { printTest } from "../../../lib/printerService";

export async function POST(req: Request) {
  const { name } = await req.json();

  const success = printTest(name);
    try {
  return NextResponse.json({success: success});
  } catch (error) {
    return NextResponse.json({
      success: success,
      data: [],
      error: String(error),
    });
  }
}