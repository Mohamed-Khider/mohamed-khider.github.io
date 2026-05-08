import net from "net";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const zpl = body?.zpl;
  const printerIp = body?.printerIp || process.env.ZEBRA_PRINTER_IP;
  const port = body?.port || 9100;

  if (!zpl || typeof zpl !== "string") {
    return NextResponse.json({ error: "Missing ZPL payload." }, { status: 400 });
  }

  if (!printerIp || typeof printerIp !== "string") {
    return NextResponse.json(
      { error: "Printer IP is not configured. Set ZEBRA_PRINTER_IP or provide printerIp in the request." },
      { status: 400 }
    );
  }

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    socket.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    socket.connect(port, printerIp, () => {
      socket.write(zpl, (err) => {
        if (err) {
          if (!settled) {
            settled = true;
            reject(err);
          }
        } else {
          socket.end(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          });
        }
      });
    });
  });

  return NextResponse.json({ success: true });
}
