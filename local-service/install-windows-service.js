const path = require("path");
const { execFileSync } = require("child_process");
const { Service } = require("node-windows");

const serviceName = "WarehouseLocalPrintService";
const scriptPath = path.join(__dirname, "server.js");

function isElevated() {
  try {
    execFileSync("net", ["session"], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function requestElevation() {
  const command = `Start-Process -FilePath '${process.execPath}' -ArgumentList '${__filename.replace(/'/g, "''")}' -Verb RunAs`;
  execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { stdio: "inherit", windowsHide: true }
  );
}

if (process.platform !== "win32") {
  console.error("Windows service installation is only supported on Windows.");
  process.exit(1);
}

if (!isElevated()) {
  console.log("Requesting administrator access to install the local print service...");
  requestElevation();
  process.exit(0);
}

const service = new Service({
  name: serviceName,
  description: "Local printer bridge for Warehouse Label System Zebra ZPL printing.",
  script: scriptPath,
  nodeOptions: ["--harmony"],
  env: [
    {
      name: "WAREHOUSE_PRINT_SERVICE_HOST",
      value: "localhost",
    },
    {
      name: "WAREHOUSE_PRINT_SERVICE_PORT",
      value: "1995",
    },
  ],
});

service.on("install", () => {
  console.log(`${serviceName} installed.`);
  service.start();
});

service.on("alreadyinstalled", () => {
  console.log(`${serviceName} is already installed. Starting service...`);
  service.start();
});

service.on("start", () => {
  console.log(`${serviceName} started on http://localhost:1995`);
});

service.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

service.install();
