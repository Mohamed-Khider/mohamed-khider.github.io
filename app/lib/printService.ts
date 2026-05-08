export async function sendZplToPrinter(zpl: string, printerIp?: string) {
  const response = await fetch("/api/print-zpl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zpl, printerIp }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || response.statusText);
  }
}
