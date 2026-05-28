import net from "net";

export function sendZPL(ip: string, zpl: string) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(9100, ip, () => {
      client.write(zpl);
      client.end();
      resolve(true);
    });

    client.on("error", reject);
  });
}