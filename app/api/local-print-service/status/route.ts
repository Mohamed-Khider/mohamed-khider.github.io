import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("http://127.0.0.1:3001/health", {
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
