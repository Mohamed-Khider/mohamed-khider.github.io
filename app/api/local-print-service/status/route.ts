import { NextResponse } from "next/server";

const SERVICE_URL = process.env.WAREHOUSE_PRINT_SERVICE_URL || "http://localhost:1995";
export async function GET() {
  const response = await fetch(SERVICE_URL + "/health", {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({
      success: true,
      running: false,
    });
  }

  const data = await response.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    running: true,
    data,
  });
}
