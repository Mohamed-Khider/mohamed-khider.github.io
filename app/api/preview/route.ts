import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { zpl, width, height } = body;

    if (!zpl || !width || !height) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Convert dots → inches (203 DPI)
    const widthInches = (width / 203).toFixed(2);
    const heightInches = (height / 203).toFixed(2);

    const labelaryUrl = `https://api.labelary.com/v1/printers/8dpmm/labels/${widthInches}x${heightInches}/0/`;

    const response = await fetch(labelaryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: zpl,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Labelary error", details: text },
        { status: 500 }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}