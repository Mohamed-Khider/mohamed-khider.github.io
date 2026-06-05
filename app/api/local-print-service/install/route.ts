import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const installerPath = path.join(
      process.cwd(),
      "local-service",
      "install-windows-service.js"
    );

    const child = spawn(process.execPath, [installerPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });

    child.unref();

    return NextResponse.json({
      success: true,
      message: "Windows will ask for administrator access to install the local print service.",
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
