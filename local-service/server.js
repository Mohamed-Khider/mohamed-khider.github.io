const http = require("http");
const {
  getDefaultPrinterName,
  getPrinters,
  printTest,
  sendRawZplToPrinter,
  setDefaultPrinterAsync,
} = require("./printer-core");

// const HOST = process.env.WAREHOUSE_PRINT_SERVICE_HOST || "localhost";
const HOST =  "localhost";
// const PORT = Number(`process.env.WAREHOUSE_PRINT_SERVICE_PORT` || 1995);
const PORT = Number(1995);
const SERVICE_NAME = "warehouse-local-print-service";

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
  });
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { success: true });
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        success: true,
        service: SERVICE_NAME,
        defaultPrinterName: getDefaultPrinterName(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/printers") {
      sendJson(res, 200, {
        success: true,
        data: getPrinters(),
        defaultPrinterName: getDefaultPrinterName(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/printers/default") {
      const body = await readBody(req);
      const printerName = body.name || body.printerName;

      if (!printerName || typeof printerName !== "string") {
        sendJson(res, 400, { success: false, error: "Printer name is required." });
        return;
      }

      await setDefaultPrinterAsync(printerName);
      sendJson(res, 200, { success: true, defaultPrinterName: printerName });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/printers/print") {
      const body = await readBody(req);
      const printerName = body.name || body.printerName || getDefaultPrinterName();

      if (!printerName || typeof printerName !== "string") {
        sendJson(res, 400, { success: false, error: "Printer name is required." });
        return;
      }

      printTest(printerName);
      sendJson(res, 200, { success: true, printerName });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/printers/zpl") {
      const body = await readBody(req);
      const zpl = body.zpl;
      const printerName = body.printerName || body.name || getDefaultPrinterName();

      if (!zpl || typeof zpl !== "string") {
        sendJson(res, 400, { success: false, error: "Missing ZPL payload." });
        return;
      }

      if (!printerName || typeof printerName !== "string") {
        sendJson(res, 400, { success: false, error: "No default printer is selected." });
        return;
      }

      sendRawZplToPrinter(printerName, zpl);
      sendJson(res, 200, { success: true, printerName });
      return;
    }

    sendJson(res, 404, { success: false, error: "Endpoint not found." });
  } catch (error) {
    sendJson(res, 500, { success: false, error: String(error.message || error) });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`${SERVICE_NAME} listening on http://${HOST}:${PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
