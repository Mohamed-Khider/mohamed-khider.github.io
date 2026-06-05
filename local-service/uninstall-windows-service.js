const { execFileSync } = require("child_process");
const { Service } = require("node-windows");

const serviceName = "WarehouseLocalPrintService";

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
  console.error("Windows service removal is only supported on Windows.");
  process.exit(1);
}

if (!isElevated()) {
  console.log("Requesting administrator access to remove the local print service...");
  requestElevation();
  process.exit(0);
}

const service = new Service({
  name: serviceName,
  script: require("path").join(__dirname, "server.js"),
});

service.on("uninstall", () => {
  console.log(`${serviceName} removed.`);
});

service.on("alreadyuninstalled", () => {
  console.log(`${serviceName} is not installed.`);
});

service.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

service.uninstall();
